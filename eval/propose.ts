/**
 * スキルを変える前の改善案を確かめる。
 *
 * 使い方: deno task eval:propose --pattern P-001
 *
 * パターンの「改善案」が、失敗を一段上の原則にし、今の文の勾配と候補の比較になっているかを見る。
 * 失敗の回にだけ出る語が、原則・勾配・候補・実装の差分に入っていたら失敗にする。
 */
import { join } from "node:path";
import { parseArgs } from "node:util";

const RUN_ID = /^\d{8}-\d{6}-[A-Z]+-\d+$/;
const KINDS = ["道具", "ひな形", "手順"] as const;
const RANK: Record<(typeof KINDS)[number], number> = { 道具: 0, ひな形: 1, 手順: 2 };

export type ProposalKind = (typeof KINDS)[number];

export type ProposalResult = {
  ok: true;
  selected: number | "出さない";
  kind: ProposalKind | null;
  summary: string | null;
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

function improvementSection(markdown: string): string | null {
  const match = markdown.match(/^## 改善案[ \t]*$/m);
  if (!match || match.index === undefined) return null;
  const rest = markdown.slice(match.index + match[0].length);
  const next = rest.search(/^## /m);
  return next < 0 ? rest : rest.slice(0, next);
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
    if (hasToken(text, token)) errors.push(`${where}に、失敗の回にだけ出る語「${token}」が入っています`);
  }
}

function cellsOf(line: string): string[] {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((s) => s.trim());
}

function isSeparator(cells: readonly string[]): boolean {
  return cells.length > 0 && cells.every((cell) => /^:?-+:?$/.test(cell));
}

function parseRunCell(
  cell: string,
  row: number,
  label: string,
  knownRuns: ReadonlySet<string> | undefined,
  errors: string[],
): string[] {
  if (cell === "なし") return [];
  const ids = [...new Set(tokensOf(cell))];
  if (!ids.length) {
    errors.push(`候補${row}の${label}が空です`);
    return [];
  }
  for (const id of ids) {
    if (!RUN_ID.test(id)) errors.push(`候補${row}の${label}の実行 ID の形が違います: ${id}`);
    else if (knownRuns && !knownRuns.has(id)) errors.push(`候補${row}の実行 ID が eval/runs にありません: ${id}`);
  }
  return ids;
}

/**
 * 改善案が、原則・勾配・候補の条件を満たすかを返す。
 * knownRuns を渡したとき、書いた実行 ID がその集合に含まれるかも見る。
 * addedText を渡したとき、実装で増えた文に固有の語が無いかを見る。
 */
export function checkProposal(
  markdown: string,
  options?: { knownRuns?: ReadonlySet<string>; addedText?: string },
): ProposalResult {
  const errors: string[] = [];
  const section = improvementSection(markdown);
  if (section === null) return { ok: false, errors: ["「## 改善案」がありません"] };

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

  const tableLines = section.split("\n").map((line) => line.trim()).filter((line) => line.startsWith("|"));
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
        const failed = parseRunCell(cells[3], n, "落ちた回", options?.knownRuns, errors);
        const passed = parseRunCell(cells[4], n, "通った回", options?.knownRuns, errors);
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
  };
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

async function main() {
  const { values } = parseArgs({
    args: Deno.args,
    options: { pattern: { type: "string" } },
  });
  if (!values.pattern || !/^P-\d+$/.test(values.pattern)) throw new Error("--pattern に P-001 の形で指定してください");
  const repo = join(import.meta.dirname!, "..");
  const markdown = await Deno.readTextFile(join(repo, "eval/wiki/patterns", `${values.pattern}.md`));
  const result = checkProposal(markdown, {
    knownRuns: await knownRunIds(repo),
    addedText: await uncommittedAgentsText(repo),
  });
  if (!result.ok) {
    for (const error of result.errors) console.error(`- ${error}`);
    Deno.exit(1);
  }
  if (result.selected === "出さない") {
    console.log("改善案は条件を満たしています。選ぶは「出さない」なので、スキルは変えません。");
    return;
  }
  console.log(`改善案は条件を満たしています。実装してよいのは候補${result.selected}（${result.kind}）だけです。`);
  console.log(result.summary);
}

if (import.meta.main) {
  try {
    await main();
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    Deno.exit(1);
  }
}
