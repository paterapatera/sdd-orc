/**
 * Cursor SDK で、スキルの手順を順に送り、質問に人役の AI が答える（eval/auto.ts から Node で起動する）。
 * SDK は Deno では動かない（ripgrep の場所と、fetch のストリーミングの送信）ため、ここだけ Node で動かす。
 *
 * 使い方: node eval/sdk/driver.ts <入力の JSON ファイル>
 * 入力: { target, outDir, model, maxTurns, steps: string[], persona, issue }
 * 書くもの（outDir）: auto.jsonl（Cursor の agent-transcripts と同じ形）、persona.jsonl、auto-raw.json
 */
import { appendFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Agent, type ConversationTurn } from "@cursor/sdk";

type Input = {
  target: string;
  outDir: string;
  model: string;
  maxTurns: number;
  steps: string[];
  persona: string;
  issue: string;
};

const NEXT = "<<次へ>>";
const input: Input = JSON.parse(readFileSync(process.argv[2], "utf8"));
const apiKey = process.env.CURSOR_API_KEY || undefined;

// ---------------------------------------------------------------------------
// 人役

const personaHome = mkdtempSync(join(tmpdir(), "sdd-eval-persona-"));
const PERSONA_RULES = `あなたは、ソフトウェア開発を AI に頼んでいる人です。次の回答表だけを根拠に答えます。
回答表の「答え方」に従い、表に無いことを自分で補いません。答えだけを日本語で返し、説明や前置きを付けません。

答える前に、質問が回答表のどの行に当たるかを決め、選択肢をその行の答えと1語ずつ比べます。
- 選択肢を選ぶのは、項目、日時の形、件数、文言などがすべて表の答えと一致するときだけです。「（推奨）」が付いていても、違う点が1つでもあれば選ばず、表の答えを書きます。
- 当たる行が無い質問には「決めていません。既存の動きに合わせてください」と答えます。

# 回答表
${input.persona}

# issue の本文（求められたら渡すもの）
${input.issue}`;

async function askPersona(kind: string, task: string): Promise<string> {
  const result = await Agent.prompt(`${PERSONA_RULES}\n\n# いまの依頼\n${task}`, {
    apiKey,
    model: { id: input.model },
    local: { cwd: personaHome },
    tools: [],
  });
  const answer = (result.result ?? "").trim();
  appendFileSync(
    join(input.outDir, "persona.jsonl"),
    JSON.stringify({ kind, task, answer, status: result.status }) + "\n",
  );
  return answer;
}

/** 実行する AI の質問ツール。Cursor の AskQuestion と同じ形で受け、人役が答える */
const askQuestionTool = {
  description:
    "利用者に選択肢つきの質問をする。questions の各要素に id、prompt、options（id と label）を入れる。利用者は選択肢を選ぶか、自由に書いて答える。",
  inputSchema: {
    type: "object",
    properties: {
      title: { type: "string" },
      questions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            prompt: { type: "string" },
            options: {
              type: "array",
              items: {
                type: "object",
                properties: { id: { type: "string" }, label: { type: "string" } },
                required: ["id", "label"],
              },
            },
            allow_multiple: { type: "boolean" },
          },
          required: ["id", "prompt", "options"],
        },
      },
    },
    required: ["questions"],
  },
  async execute(args: Record<string, unknown>) {
    const task =
      `AI から次の質問が来ました。質問ごとに「質問の id: 選んだ選択肢の label（または自由に書いた答え）」の形で1行ずつ答えてください。
${JSON.stringify(args.questions, null, 2)}`;
    return await askPersona("AskQuestion", task);
  },
};

async function nextMessage(lastText: string): Promise<string> {
  const task = `AI の最後の発言は次のとおりです。
---
${lastText}
---
AI があなたの返事（回答、承認、選択、issue の本文など）を待っているなら、返事だけを書いてください。
返事を待っていない（作業の報告や完了の報告で終わっている）なら、${NEXT} とだけ書いてください。
次の工程のスキルの呼び出し（/sdd-... など）と受け入れテストの結果（OK など）は進行役が別に送るので、書きません。
AI がそれを待っているだけなら ${NEXT} とだけ書いてください。`;
  return await askPersona("next", task);
}

// ---------------------------------------------------------------------------
// チャットの記録（Cursor の agent-transcripts と同じ形）

const transcript: string[] = [];
const raw: unknown[] = [];

function recordUser(text: string) {
  transcript.push(JSON.stringify({ role: "user", message: { content: [{ type: "text", text }] } }));
}

function toolUse(call: { type?: string; args?: Record<string, unknown> }) {
  const args = call.args ?? {};
  if (call.type === "shell") return { type: "tool_use", name: "Shell", input: { command: args.command } };
  if (call.type === "mcp" && JSON.stringify(args).includes("AskQuestion")) {
    const inner = (args.args ?? args.arguments ?? args) as Record<string, unknown>;
    return { type: "tool_use", name: "AskQuestion", input: { questions: inner.questions ?? [] } };
  }
  return { type: "tool_use", name: call.type ?? "unknown", input: args };
}

function recordTurns(turns: ConversationTurn[]) {
  raw.push(...turns);
  for (const t of turns) {
    if (t.type !== "agentConversationTurn") continue;
    for (const step of t.turn.steps) {
      const content = step.type === "assistantMessage"
        ? [{ type: "text", text: step.message.text }]
        : step.type === "toolCall"
        ? [toolUse(step.message as { type?: string; args?: Record<string, unknown> })]
        : null;
      if (content) transcript.push(JSON.stringify({ role: "assistant", message: { content } }));
    }
  }
}

function save() {
  writeFileSync(join(input.outDir, "auto.jsonl"), transcript.join("\n") + "\n");
  writeFileSync(join(input.outDir, "auto-raw.json"), JSON.stringify(raw, null, 2) + "\n");
}

// ---------------------------------------------------------------------------
// 実行

/** 「/sdd-start（続けて issue の本文を貼る）」のような手順の文面から、送る文面を作る */
function stepMessage(step: string): string {
  const text = step.replace(/（[^）]*）/g, "").trim();
  return /issue の本文/.test(step) ? `${text}\n\n${input.issue}` : text;
}

const agent = await Agent.create({
  apiKey,
  model: { id: input.model },
  local: { cwd: input.target, settingSources: ["project"], customTools: { AskQuestion: askQuestionTool } },
  disallowedTools: ["askQuestion"],
});
console.log(`agent ${agent.agentId}`);
try {
  for (const step of input.steps) {
    let message = stepMessage(step);
    for (let turn = 0;; turn++) {
      if (turn >= input.maxTurns) throw new Error(`「${step}」が ${input.maxTurns} 往復で終わりませんでした`);
      console.log(`\n> ${message.split("\n")[0]}`);
      recordUser(message);
      const r = await agent.send(message);
      const result = await r.wait();
      if (r.supports("conversation")) recordTurns(await r.conversation());
      save();
      if (result.status !== "finished") {
        throw new Error(`実行が ${result.status} で終わりました: ${result.error?.message ?? ""}`);
      }
      const last = result.result ?? "";
      console.log(last.slice(-400));
      const reply = await nextMessage(last);
      // 次の工程の呼び出しは、問題の手順の文面どおりに送る（人役が書くと、同じスキルが2回呼ばれる）
      if (reply.includes(NEXT) || /\/sdd-/.test(reply)) break;
      message = reply;
    }
  }
} finally {
  save();
  await agent.close();
  rmSync(personaHome, { recursive: true, force: true });
}
