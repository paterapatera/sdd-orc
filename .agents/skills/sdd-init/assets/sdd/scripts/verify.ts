/**
 * specの内容を検証する（型チェックだけでは確かめられない内容）。
 *
 * 使い方: deno task --config docs/sdd/deno.json verify [--finish] [ISSUE...]
 *   ISSUE を省略すると docs/specs にあるすべてのissueを検証する。
 *   --finish を付けると、すべてのタスクの完了と、未確定の点が無いことも求める。
 *
 * エラーが1件でもあれば終了コード1で終わる。警告だけなら0で終わる。
 */
import { listIssueIds, loadIssue, loadVerifyContext } from "./lib/load.ts";
import { rel } from "./lib/paths.ts";
import { verifyIssue } from "./lib/rules.ts";

const args = Deno.args.filter((a) => a !== "--finish");
const finish = Deno.args.includes("--finish");
const ids = args.length > 0 ? args : await listIssueIds();

if (ids.length === 0) {
  console.log("検証するspecがありません（docs/specs が空です）");
  Deno.exit(0);
}

const verifyContext = await loadVerifyContext();
let errors = 0;
let warnings = 0;

for (const id of ids) {
  const issue = await loadIssue(id);
  const diags = verifyIssue(issue, { finish, ...verifyContext });
  errors += diags.filter((d) => d.level === "error").length;
  warnings += diags.filter((d) => d.level === "warning").length;
  const mode = { full: "完全モード", quick: "軽量モード", mixed: "混在", none: "specなし" }[issue.mode];
  console.log(`\n■ ${id}（${mode}） ${rel(issue.dir)}`);
  if (diags.length === 0) console.log("  問題ありません");
  for (const d of diags) {
    console.log(`  [${d.level === "error" ? "エラー" : "警告"}] ${d.file}: ${d.message}`);
  }
}

console.log(`\nエラー ${errors} 件、警告 ${warnings} 件`);
Deno.exit(errors > 0 ? 1 : 0);
