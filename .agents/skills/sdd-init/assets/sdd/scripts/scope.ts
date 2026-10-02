/**
 * このブランチで実際に変更したファイルと、spec の影響範囲（impact）を照合する。
 * sdd-impl の完了時に実行し、影響範囲の外の変更があれば spec を直す（specと実装のずれを残さない）。
 *
 * 使い方: deno task --config docs/sdd/deno.json scope <ISSUE>
 *
 * 影響範囲の外の変更があれば終了コード1で終わる。影響範囲にあるのに変更していないファイルは警告だけ。
 */
import { loadIssue } from "./lib/load.ts";
import { checkScope } from "./lib/scope.ts";

const id = Deno.args[0];
if (!id) {
  console.error("使い方: deno task scope <ISSUE>");
  Deno.exit(1);
}
const issue = await loadIssue(id);
const impact = issue.design?.impact ?? issue.quick?.impact;
if (!impact) {
  console.error(`docs/specs/${id} に影響範囲（design.ts または spec.ts の impact）がありません`);
  Deno.exit(1);
}
const r = await checkScope(impact);
if (!r.available) {
  console.log("既定ブランチとの分岐点が分からないため、照合できません");
  Deno.exit(0);
}
for (const f of r.outside) console.log(`  [エラー] 影響範囲に無い変更: ${f}`);
for (const f of r.untouched) console.log(`  [警告] 影響範囲にあるが変更していない: ${f}`);
if (r.outside.length === 0 && r.untouched.length === 0) console.log("影響範囲と実際の変更は一致しています");
else if (r.outside.length) {
  console.log(
    "\n影響範囲の外の変更があります。spec の impact（とコンポーネントの files）を直すか、変更を取り消してください",
  );
}
Deno.exit(r.outside.length ? 1 : 0);
