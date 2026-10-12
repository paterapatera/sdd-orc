/**
 * スキルを変える前の改善案を確かめる。依頼の経路では、流し直した結果から採否も判定する。
 *
 * 使い方:
 *   deno task eval:propose --pattern P-001
 *     訓練の経路。eval/wiki/patterns/P-001.md を読み、事例の ID は eval/runs の実行 ID にする
 *   deno task eval:propose --file eval/wiki/requests/R-001.md
 *     依頼の経路。「## 事例」の ID で候補を当てる
 *
 * 改善案が、失敗を一段上の原則にし、今の文の勾配と候補の比較になっているかを見る。
 * 事例の場面にだけ出る語が、原則・勾配・候補・未コミットの .agents の追加行に入っていたら失敗にする。
 */
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";

const RUN_ID = /^\d{8}-\d{6}-[A-Z]+-\d+$/;
const CASE_ID = /^[A-Za-z0-9][A-Za-z0-9_.-]*$/;
const KINDS = ["道具", "ひな形", "手順"] as const;
const RANK: Record<(typeof KINDS)[number], number> = { 道具: 0, ひな形: 1, 手順: 2 };
const CASE_RESULTS = ["落ちた", "通った"] as const;
const REPLAY_RESULTS = ["通った", "落ちた", "再現できない"] as const;

export type ProposalKind = (typeof KINDS)[number];
export type CaseResult = (typeof CASE_RESULTS)[number];
type ReplayResult = (typeof REPLAY_RESULTS)[number];

export type ProposalResult = {
  ok: true;
  selected: number | "出さない";
  kind: ProposalKind | null;
  summary: string | null;
  /** 選んだ候補が拾う落ちた事例 */
  targets: string[];
  /** 「## 事例」の結果。無ければ null */
  cases: ReadonlyMap<string, CaseResult> | null;
} | {
  ok: false;
  errors: string[];
};

export type ReplayJudgement = {
  ok: true;
  decision: "採用" | "却下" | "保留";
  reasons: string[];
} | {
  ok: false;
  errors: string[];
};

type Row = {
  n: number;
  kind: ProposalKind;
  summary: string;
  failed: string[];
  passed: string[];
  /** ミニバッチを通らない理由。通るときは null */
  blocked: string | null;
};

/** `git diff` の追加行だけを取り出す */
export function addedLines(diff: string): string {
  return diff.split("\n").filter((line) => line.startsWith("+") && !line.startsWith("+++")).map((line) => line.slice(1))
    .join("\n");
}

function sectionOf(markdown: string, title: string): string | null {
  const match = markdown.match(new RegExp(`^## ${title}[ \\t]*$`, "m"));
  if (!match || match.index === undefined) return null;
  const rest = markdown.slice(match.index + match[0].length);
  const next = rest.search(/^## /m);
  return next < 0 ? rest : rest.slice(0, next);
}

function tableLinesOf(section: string): string[] {
  return section.split("\n").map((line) => line.trim()).filter((line) => line.startsWith("|"));
}

/** 「## 事例」の表を読む。節が無ければ null */
function parseCases(markdown: string, errors: string[]): Map<string, CaseResult> | null {
  const section = sectionOf(markdown, "事例");
  if (section === null) return null;
  const cases = new Map<string, CaseResult>();
  const lines = tableLinesOf(section);
  if (!lines.length) {
    errors.push("事例の表がありません");
    return cases;
  }
  if (cellsOf(lines[0]).join(",") !== "ID,今,場面,期待") {
    errors.push("事例の表の見出しは、ID、今、場面、期待の順にしてください");
    return cases;
  }
  for (const line of lines.slice(1)) {
    const cells = cellsOf(line);
    if (isSeparator(cells)) continue;
    if (cells.length !== 4) {
      errors.push("事例の表は4列にしてください");
      continue;
    }
    const [id, now, scene, expected] = cells;
    if (!CASE_ID.test(id)) errors.push(`事例の ID の形が違います: ${id}`);
    else if (cases.has(id)) errors.push(`事例の ID が重なっています: ${id}`);
    else if (!CASE_RESULTS.includes(now as CaseResult)) {
      errors.push(`事例 ${id} の今は、落ちた か 通った にしてください`);
    } else if (!scene) errors.push(`事例 ${id} の場面が空です`);
    else if (!expected) errors.push(`事例 ${id} の期待が空です`);
    else cases.set(id, now as CaseResult);
  }
  const values = [...cases.values()];
  if (!values.includes("落ちた")) errors.push("事例に、落ちた事例が1件もありません");
  if (!values.includes("通った")) errors.push("事例に、変えてはいけない通った事例が1件もありません");
  return cases;
}

function field(section: string, name: string): string | null {
  const match = section.match(new RegExp(`^- ${name}:[ \\t]*(.*)$`, "m"));
  return match ? match[1].trim() : null;
}

function tokensOf(value: string): string[] {
  return value.split(/[、,，]/).map((s) => s.trim()).filter(Boolean);
}

function hasToken(text: string, token: string): boolean {
  return text.toLowerCase().includes(token.toLowerCase());
}

function forbid(text: string, tokens: readonly string[], where: string, errors: string[]) {
  for (const token of tokens) {
    if (hasToken(text, token)) errors.push(`${where}に、事例にだけ出る語「${token}」が入っています`);
  }
}

function cellsOf(line: string): string[] {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((s) => s.trim());
}

function isSeparator(cells: readonly string[]): boolean {
  return cells.length > 0 && cells.every((cell) => /^:?-+:?$/.test(cell));
}

type IdContext = { cases: ReadonlyMap<string, CaseResult> | null; knownRuns?: ReadonlySet<string> };

function parseIdCell(
  cell: string,
  row: number,
  label: "落ちた回" | "通った回",
  ctx: IdContext,
  errors: string[],
): string[] {
  if (cell === "なし") return [];
  const ids = [...new Set(tokensOf(cell))];
  if (!ids.length) {
    errors.push(`候補${row}の${label}が空です`);
    return [];
  }
  const expected: CaseResult = label === "落ちた回" ? "落ちた" : "通った";
  for (const id of ids) {
    if (ctx.cases) {
      const result = ctx.cases.get(id);
      if (!result) errors.push(`候補${row}の${label}の ${id} が、事例にありません`);
      else if (result !== expected) errors.push(`候補${row}の${label}の ${id} は、事例では「${result}」です`);
    } else if (!RUN_ID.test(id)) {
      errors.push(`候補${row}の${label}の実行 ID の形が違います: ${id}`);
    }
    if (ctx.knownRuns && RUN_ID.test(id) && !ctx.knownRuns.has(id)) {
      errors.push(`候補${row}の実行 ID が eval/runs にありません: ${id}`);
    }
  }
  return ids;
}

/**
 * 改善案が、原則・勾配・候補の条件を満たすかを返す。
 * 「## 事例」があれば、候補の ID はその事例に当てる。無ければ実行 ID とみなす。
 * requireCases のとき、「## 事例」が無ければ失敗にする（事例の経路）。
 * knownRuns を渡したとき、書いた実行 ID がその集合に含まれるかも見る。
 * addedText を渡したとき、実装で増えた文に固有の語が無いかを見る。
 */
export function checkProposal(
  markdown: string,
  options?: { knownRuns?: ReadonlySet<string>; addedText?: string; requireCases?: boolean },
): ProposalResult {
  const errors: string[] = [];
  const section = sectionOf(markdown, "改善案");
  if (section === null) return { ok: false, errors: ["「## 改善案」がありません"] };
  const cases = parseCases(markdown, errors);
  if (!cases && options?.requireCases) errors.push("「## 事例」がありません");
  const ctx: IdContext = { cases, knownRuns: options?.knownRuns };

  const principle = field(section, "原則");
  const proper = field(section, "固有");
  const gradient = field(section, "勾配");
  const selectField = field(section, "選ぶ");

  if (!principle) errors.push("「原則」がありません");
  else if (principle.length < 12 || principle.length > 200) {
    errors.push("原則は、固有の語を消しても残る1文にしてください（12文字以上200文字以内）");
  }

  const tokens = proper ? tokensOf(proper) : [];
  const usable = tokens.filter((token) => token !== "なし" && token.length >= 2);
  if (
    !proper || proper === "なし" || tokens.length === 0 || tokens.includes("なし") || tokens.some((t) => t.length < 2)
  ) {
    errors.push("固有には、この失敗の回にだけ出る語を、2文字以上で書いてください");
  }

  if (principle) forbid(principle, usable, "原則", errors);

  if (!gradient) errors.push("「勾配」がありません");
  else {
    const arrow = gradient.indexOf("→");
    if (arrow < 0) errors.push("勾配は「今の振る舞い → 動かす方向」の形にしてください");
    else if (gradient.slice(0, arrow).trim().length < 4 || gradient.slice(arrow + 1).trim().length < 4) {
      errors.push("勾配の左右を、両方書いてください");
    }
    forbid(gradient, usable, "勾配", errors);
  }

  let selected: number | "出さない" | undefined;
  if (!selectField) errors.push("「選ぶ」がありません");
  else if (selectField === "出さない") selected = "出さない";
  else if (/^\d+$/.test(selectField)) selected = Number(selectField);
  else errors.push("選ぶは、候補の番号か「出さない」にしてください");

  const tableLines = tableLinesOf(section);
  const rows: Row[] = [];
  let tableOk = false;
  if (!tableLines.length) errors.push("候補の表がありません");
  else {
    const header = cellsOf(tableLines[0]);
    if (header.join(",") !== "#,種類,内容,落ちた回,通った回") {
      errors.push("候補の表の見出しは、#、種類、内容、落ちた回、通った回の順にしてください");
    } else {
      tableOk = true;
      for (const line of tableLines.slice(1)) {
        const cells = cellsOf(line);
        if (isSeparator(cells)) continue;
        if (cells.length !== 5) {
          errors.push("候補の表は5列にしてください");
          tableOk = false;
          continue;
        }
        const n = Number(cells[0]);
        if (!/^\d+$/.test(cells[0])) {
          errors.push(`候補の番号が数値ではありません: ${cells[0]}`);
          tableOk = false;
          continue;
        }
        const kind = cells[1] as ProposalKind;
        if (!KINDS.includes(kind)) {
          errors.push(`候補${n}の種類は、道具、ひな形、手順のいずれかにしてください`);
          tableOk = false;
          continue;
        }
        if (!cells[2]) {
          errors.push(`候補${n}の内容が空です`);
          tableOk = false;
          continue;
        }
        forbid(cells[2], usable, `候補${n}の内容`, errors);
        const failed = parseIdCell(cells[3], n, "落ちた回", ctx, errors);
        const passed = parseIdCell(cells[4], n, "通った回", ctx, errors);
        const overlap = failed.filter((id) => passed.includes(id));
        let blocked: string | null = null;
        if (!failed.length) blocked = "落ちた回がありません";
        else if (overlap.length) {
          blocked = "落ちた回と通った回に同じ実行があります";
          errors.push(`候補${n}の落ちた回と通った回に、同じ実行 ID があります`);
        } else if (kind !== "道具" && !passed.length) {
          blocked = "ひな形と手順は、通った回が要ります";
        }
        rows.push({ n, kind, summary: cells[2], failed, passed, blocked });
      }
      if (rows.length < 2 || rows.length > 3) {
        errors.push(`候補は2件か3件にしてください（今は${rows.length}件）`);
        tableOk = false;
      } else if (rows.some((row, i) => row.n !== i + 1)) {
        errors.push("候補の番号は 1 から順にしてください");
        tableOk = false;
      } else {
        const seen = new Set<string>();
        for (const row of rows) {
          const key = row.summary.replace(/\s+/g, "");
          if (seen.has(key)) errors.push(`候補${row.n}の内容が、ほかの候補と同じです`);
          seen.add(key);
        }
      }
    }
  }

  if (options?.addedText) forbid(options.addedText, usable, "実装の差分", errors);

  if (tableOk && selected !== undefined) {
    const passing = rows.filter((row) => row.blocked === null);
    if (!passing.length) {
      if (selected !== "出さない") {
        const row = rows.find((r) => r.n === selected);
        errors.push(
          row?.blocked
            ? `候補${row.n}はミニバッチを通っていません。${row.blocked}`
            : "通った候補がありません。選ぶは「出さない」にしてください",
        );
      }
    } else if (selected === "出さない") {
      errors.push("通った候補があります。選ぶに番号を書いてください");
    } else {
      const row = rows.find((r) => r.n === selected);
      if (!row) errors.push(`選ぶの ${selected} は、候補の番号にありません`);
      else if (row.blocked) errors.push(`候補${row.n}はミニバッチを通っていません。${row.blocked}`);
      else {
        const bestRank = Math.min(...passing.map((r) => RANK[r.kind]));
        const best = passing.filter((r) => RANK[r.kind] === bestRank);
        const most = Math.max(...best.map((r) => r.failed.length));
        const eligible = best.filter((r) => r.failed.length === most);
        if (!eligible.some((r) => r.n === selected)) {
          const nums = eligible.map((r) => r.n).join("、");
          errors.push(`選ぶは、種類が強く落ちた回をより多く拾う候補 ${nums} にしてください`);
        }
      }
    }
  }

  if (errors.length) return { ok: false, errors };
  const chosen = selected === "出さない" ? undefined : rows.find((row) => row.n === selected);
  return {
    ok: true,
    selected: selected ?? "出さない",
    kind: chosen?.kind ?? null,
    summary: chosen?.summary ?? null,
    targets: chosen?.failed ?? [],
    cases,
  };
}

/**
 * 変えたスキルで事例を流し直した「## 結果」から、採否を判定する。節が無ければ null。
 * 採用: 選んだ候補の落ちた事例がすべて通り、通っていた事例が1件も落ちていない。
 * 却下: 選んだ候補の落ちた事例が残ったか、通っていた事例が落ちた。
 * 保留: 結果に無い事例か、再現できない事例がある。
 */
export function judgeReplay(
  markdown: string,
  proposal: Extract<ProposalResult, { ok: true }>,
): ReplayJudgement | null {
  const section = sectionOf(markdown, "結果");
  if (section === null) return null;
  const errors: string[] = [];
  const cases = proposal.cases;
  if (!cases) return { ok: false, errors: ["結果を判定するには「## 事例」が要ります"] };
  if (proposal.selected === "出さない") return { ok: false, errors: ["選ぶが「出さない」なので、結果は書きません"] };
  const lines = tableLinesOf(section);
  if (!lines.length || cellsOf(lines[0]).join(",") !== "ID,後") {
    return { ok: false, errors: ["結果の表の見出しは、ID、後の順にしてください"] };
  }
  const after = new Map<string, ReplayResult>();
  for (const line of lines.slice(1)) {
    const cells = cellsOf(line);
    if (isSeparator(cells)) continue;
    const [id, result] = cells;
    if (cells.length !== 2) errors.push("結果の表は2列にしてください");
    else if (!cases.has(id)) errors.push(`結果の ${id} が、事例にありません`);
    else if (after.has(id)) errors.push(`結果の ID が重なっています: ${id}`);
    else if (!REPLAY_RESULTS.includes(result as ReplayResult)) {
      errors.push(`結果 ${id} の後は、通った、落ちた、再現できない のいずれかにしてください`);
    } else after.set(id, result as ReplayResult);
  }
  if (errors.length) return { ok: false, errors };

  const rejected: string[] = [];
  const pending: string[] = [];
  for (const id of proposal.targets) {
    if (after.get(id) === "落ちた") rejected.push(`選んだ候補が拾うはずの ${id} が、まだ落ちる`);
  }
  for (const [id, before] of cases) {
    const now = after.get(id);
    if (now === undefined) pending.push(`${id} を流し直していない`);
    else if (now === "再現できない") pending.push(`${id} を再現できない`);
    else if (before === "通った" && now === "落ちた") rejected.push(`通っていた ${id} が落ちた`);
  }
  if (rejected.length) return { ok: true, decision: "却下", reasons: [...rejected, ...pending] };
  if (pending.length) return { ok: true, decision: "保留", reasons: pending };
  return { ok: true, decision: "採用", reasons: [] };
}

async function git(repo: string, ...args: string[]): Promise<string> {
  const out = await new Deno.Command("git", { args, cwd: repo, stdout: "piped", stderr: "piped" }).output();
  if (!out.success) throw new Error(`git ${args.join(" ")}: ${new TextDecoder().decode(out.stderr).trim()}`);
  return new TextDecoder().decode(out.stdout);
}

async function uncommittedAgentsText(repo: string): Promise<string> {
  const diff = addedLines(await git(repo, "diff", "-U0", "HEAD", "--", ".agents"));
  const untracked = (await git(repo, "ls-files", "--others", "--exclude-standard", "--", ".agents")).split("\n")
    .map((line) => line.trim()).filter(Boolean);
  const files = await Promise.all(untracked.map((rel) => Deno.readTextFile(join(repo, rel))));
  return [diff, ...files].join("\n");
}

async function knownRunIds(repo: string): Promise<Set<string>> {
  const ids = new Set<string>();
  try {
    for await (const entry of Deno.readDir(join(repo, "eval/runs"))) {
      if (entry.isDirectory) ids.add(entry.name);
    }
  } catch (e) {
    if (e instanceof Deno.errors.NotFound) throw new Error("eval/runs が無いので、実行 ID を確かめられません");
    throw e;
  }
  return ids;
}

function fail(errors: readonly string[]): never {
  for (const error of errors) console.error(`- ${error}`);
  Deno.exit(1);
}

async function main() {
  const { values } = parseArgs({
    args: Deno.args,
    options: {
      pattern: { type: "string" },
      file: { type: "string" },
    },
  });
  const repo = join(import.meta.dirname!, "..");
  // deno task はリポジトリの根で動くので、相対パスは呼び出した場所から解決する
  const base = Deno.env.get("INIT_CWD") ?? Deno.cwd();
  let markdown: string;
  let result: ProposalResult;
  if (values.pattern) {
    if (values.file) throw new Error("--pattern と --file は一緒に指定できません");
    if (!/^P-\d+$/.test(values.pattern)) throw new Error("--pattern に P-001 の形で指定してください");
    markdown = await Deno.readTextFile(join(repo, "eval/wiki/patterns", `${values.pattern}.md`));
    result = checkProposal(markdown, {
      knownRuns: await knownRunIds(repo),
      addedText: await uncommittedAgentsText(repo),
    });
  } else if (values.file) {
    markdown = await Deno.readTextFile(resolve(base, values.file));
    result = checkProposal(markdown, { requireCases: true, addedText: await uncommittedAgentsText(repo) });
  } else {
    throw new Error("--pattern P-001 か、--file eval/wiki/requests/R-001.md を指定してください");
  }
  if (!result.ok) fail(result.errors);
  if (result.selected === "出さない") {
    console.log("改善案は条件を満たしています。選ぶは「出さない」なので、スキルは変えません。");
    return;
  }
  console.log(`改善案は条件を満たしています。実装してよいのは候補${result.selected}（${result.kind}）だけです。`);
  console.log(result.summary);
  if (!values.file) return;
  const replay = judgeReplay(markdown, result);
  if (!replay) return;
  if (!replay.ok) fail(replay.errors);
  console.log(`判定: ${replay.decision}`);
  for (const reason of replay.reasons) console.log(`  - ${reason}`);
  if (replay.decision !== "採用") Deno.exit(1);
}

if (import.meta.main) {
  try {
    await main();
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    Deno.exit(1);
  }
}
