/**
 * 人向けのHTMLを生成する。specの正本はTypeScriptで、HTMLはそこから生成する派生物。
 *
 * 使い方: deno task --config docs/sdd/deno.json render [ISSUE...]
 *   ISSUE を省略すると docs/specs にあるすべてのissueを対象にする。
 *   出力先: .sdd/out/<ISSUE>/index.html（.gitignore の対象）
 */
import { join } from "node:path";
import { listIssueIds, loadIssue, loadVerifyContext } from "../scripts/lib/load.ts";
import { OUT_DIR, rel, ROOT } from "../scripts/lib/paths.ts";
import { verifyIssue } from "../scripts/lib/rules.ts";
import { taskCommits } from "../scripts/lib/git.ts";
import { esc, renderPage } from "./html.ts";
import { extractTitle } from "./markdown.ts";
import { fullSections, quickSections, type Section, statsHtml, taskStats } from "./sections.ts";

async function git(...args: string[]): Promise<string | undefined> {
  try {
    const { code, stdout } = await new Deno.Command("git", { args, cwd: ROOT, stdout: "piped", stderr: "null" })
      .output();
    return code === 0 ? new TextDecoder().decode(stdout).trim() : undefined;
  } catch {
    return undefined;
  }
}

const ids = Deno.args.length > 0 ? Deno.args : await listIssueIds();
if (ids.length === 0) {
  console.log("生成するspecがありません（docs/specs が空です）");
  Deno.exit(0);
}

const verifyContext = await loadVerifyContext();
const branch = await git("branch", "--show-current");
const commit = await git("rev-parse", "--short", "HEAD");
const now = new Date();
const generatedAt = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${
  String(now.getDate()).padStart(2, "0")
} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

for (const id of ids) {
  const issue = await loadIssue(id);
  const diags = verifyIssue(issue, verifyContext);
  const title = extractTitle(issue.issueMd) ?? id;

  let sections: Section[];
  let modeLabel: string;
  let stats: [string, string | number][];
  if (issue.mode === "quick" && issue.quick) {
    const q = issue.quick;
    modeLabel = "軽量モード";
    sections = quickSections(issue, diags, await taskCommits(id));
    stats = [
      ["期待する動作", Object.keys(q.expected).length],
      ["受け入れ条件", Object.values(q.expected).reduce((n, fr) => n + fr.acceptance.length, 0)],
      ["変えてはいけない振る舞い", Object.keys(q.invariants).length],
      ["タスク完了", taskStats(q.tasks)],
    ];
  } else {
    const r = issue.requirements;
    modeLabel = issue.mode === "mixed" ? "混在（要修正）" : issue.mode === "none" ? "specなし" : "完全モード";
    sections = fullSections(issue, diags, await taskCommits(id));
    stats = [
      ["機能要件", r ? Object.keys(r.functional).length : "—"],
      ["非機能要件", r ? Object.keys(r.nonFunctional).length : "—"],
      ["受け入れ条件", r ? Object.values(r.functional).reduce((n, fr) => n + fr.acceptance.length, 0) : "—"],
      ["コンポーネント", issue.design ? Object.keys(issue.design.components).length : "—"],
      ["タスク完了", taskStats(issue.tasks?.tasks)],
    ];
  }

  const errors = diags.filter((d) => d.level === "error").length;
  const warnings = diags.length - errors;
  const html = renderPage({
    title: title.startsWith(id) ? title : `${id} ${title}`,
    subtitle: `SDD ${modeLabel}`,
    meta: [
      ["issue", esc(id)],
      ["モード", esc(modeLabel)],
      ["ブランチ", branch ? `<code>${esc(branch)}</code>` : "—"],
      ["コミット", commit ? `<code>${esc(commit)}</code>` : "—"],
      ["生成日時", esc(generatedAt)],
      ["検証", errors ? `エラー ${errors} 件、警告 ${warnings} 件` : warnings ? `警告 ${warnings} 件` : "問題なし"],
    ],
    nav: sections.map((s) => s.nav),
    body: statsHtml(stats) + sections.map((s) => s.html).join("\n"),
  });

  const outDir = join(OUT_DIR, id);
  await Deno.mkdir(outDir, { recursive: true });
  const outPath = join(outDir, "index.html");
  await Deno.writeTextFile(outPath, html);
  console.log(`${id}: ${rel(outPath)}`);
}
