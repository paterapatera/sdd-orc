/**
 * specの内容を検証する（型チェックだけでは確かめられない内容）。
 *
 * 使い方: bun docs/sdd/scripts/verify.ts [--finish] [--answered ANS-001,ANS-002] [ISSUE...]
 *   ISSUE を省略すると docs/specs にあるすべてのissueを検証する。
 *   --finish を付けると、すべてのタスクの完了と、未確定の点が無いことも求める。
 *   --answered を付けると、確認ポイントでユーザーが答えた構成の回答の ID を記録する（ISSUE を1つだけ指定する）。
 *     記録できるのは、verify が未回答として一覧に出し、design.ts に answer がある ID だけ。
 *
 * エラーが1件でもあれば終了コード1で終わる。警告だけなら0で終わる。
 */
import { args as cliArgs, exit } from "./lib/io.ts";
import {
  listIssueIds,
  loadAnswerRecords,
  loadIssue,
  loadVerifyContext,
  recordAnswered,
  recordAsked,
} from "./lib/load.ts";
import { rel } from "./lib/paths.ts";
import { placementSources, structureAnswerList, unansweredStructureIds, verifyIssue } from "./lib/rules.ts";

let finish = false;
const answeredArgs: string[] = [];
const issueArgs: string[] = [];
for (let i = 0; i < cliArgs.length; i++) {
  const a = cliArgs[i];
  if (a === "--finish") finish = true;
  else if (a === "--answered") answeredArgs.push(...(cliArgs[++i] ?? "").split(","));
  else if (a.startsWith("--answered=")) answeredArgs.push(...a.slice("--answered=".length).split(","));
  else issueArgs.push(a);
}
const answeredIds = answeredArgs.map((s) => s.trim()).filter(Boolean);
const ids = issueArgs.length > 0 ? issueArgs : await listIssueIds();

if (ids.length === 0) {
  console.log("検証するspecがありません（docs/specs が空です）");
  exit(0);
}
if (answeredArgs.length && (ids.length !== 1 || answeredIds.length === 0)) {
  console.log("--answered には、回答の ID と、ISSUE を1つだけ指定してください");
  exit(1);
}

const verifyContext = await loadVerifyContext();
let errors = 0;
let warnings = 0;
let full = false;

for (const id of ids) {
  const issue = await loadIssue(id);
  if (issue.mode === "full") full = true;
  if (answeredIds.length) {
    const { asked } = await loadAnswerRecords(id);
    const answers = (issue.design?.answers ?? {}) as Readonly<Record<string, { answer?: string }>>;
    const ok = answeredIds.filter((a) => asked.has(a) && answers[a]?.answer !== undefined);
    for (const a of answeredIds.filter((x) => !ok.includes(x))) {
      errors++;
      console.log(
        asked.has(a)
          ? `[エラー] ${a} は design.ts に answer が無いので、ユーザーの回答として記録できません。先に answer を書いてください`
          : `[エラー] ${a} は verify が未回答として一覧に出していないので、ユーザーの回答として記録できません`,
      );
    }
    await recordAnswered(id, ok);
    if (ok.length) console.log(`ユーザーの回答として記録しました: ${ok.join("、")}`);
  }
  const answerRecords = await loadAnswerRecords(id);
  const diags = verifyIssue(issue, { finish, ...verifyContext, answerRecords });
  errors += diags.filter((d) => d.level === "error").length;
  warnings += diags.filter((d) => d.level === "warning").length;
  const mode = { full: "完全モード", quick: "軽量モード", mixed: "混在", none: "specなし" }[issue.mode];
  console.log(`\n■ ${id}（${mode}） ${rel(issue.dir)}`);
  if (diags.length === 0) console.log("  問題ありません");
  for (const d of diags) {
    console.log(`  [${d.level === "error" ? "エラー" : "警告"}] ${d.file}: ${d.message}`);
  }
  const answers = structureAnswerList(issue);
  if (answers.length) {
    console.log(`\n■ ${id} の人に確かめる構成の回答（設計の終わりの確認ポイントで、この一覧をそのまま見せる）`);
    for (const line of answers) console.log(`  ${line}`);
    await recordAsked(id, unansweredStructureIds(issue));
  }
}

if (full) {
  const sources = placementSources(verifyContext);
  console.log("\n■ 置き場所を決めている恒久ドキュメント（新しい部品の置き場所は、まずここから決める）");
  if (sources.length === 0) console.log("  なし");
  for (const s of sources) console.log(`  ${s}`);
}

console.log(`\nエラー ${errors} 件、警告 ${warnings} 件`);
exit(errors > 0 ? 1 : 0);
