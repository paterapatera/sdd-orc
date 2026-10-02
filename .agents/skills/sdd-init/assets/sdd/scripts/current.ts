/**
 * 今のブランチに対応する issue を特定する。
 *
 * 使い方: deno task --config docs/sdd/deno.json current [--id-only]
 *   --id-only  issue の ID だけを表示する
 *
 * ブランチ名は `<branchPrefix><ID を小文字にしたもの>-<slug>`（例: feature/gh-2-print-date）。
 * ID には大文字やハイフンが含まれ得るので、docs/specs にあるディレクトリ名と大文字小文字を区別せずに照合する。
 */
import { join } from "node:path";
import { loadConfig } from "./lib/config.ts";
import { gitOut } from "./lib/git.ts";
import { listIssueIds } from "./lib/load.ts";
import { exists, SPECS_DIR } from "./lib/paths.ts";

const idOnly = Deno.args.includes("--id-only");
const branch = await gitOut(["branch", "--show-current"]);
if (!branch) {
  console.error("ブランチが分かりません（detached HEAD など）");
  Deno.exit(1);
}

const { branchPrefix } = await loadConfig();
const rest = (branch.startsWith(branchPrefix) ? branch.slice(branchPrefix.length) : branch).toLowerCase();
const matches = (await listIssueIds())
  .filter((id) => rest === id.toLowerCase() || rest.startsWith(id.toLowerCase() + "-"))
  .sort((a, b) => b.length - a.length);

if (matches.length === 0) {
  console.error(`今のブランチ（${branch}）に対応する docs/specs/<ID> がありません`);
  Deno.exit(1);
}

const id = matches[0];
if (idOnly) {
  console.log(id);
  Deno.exit(0);
}

const dir = join(SPECS_DIR, id);
const has = async (f: string) => await exists(join(dir, f));
let mode = "specなし";
if (await has("spec.ts")) mode = "軽量モード";
else if (await has("requirements.ts")) mode = "完全モード";
else if (await has("issue.md")) {
  const m = (await Deno.readTextFile(join(dir, "issue.md"))).match(/^- モード:\s*(.+)$/m);
  if (m) mode = `${m[1].trim()}（specはまだ無い）`;
}
console.log(`issue: ${id}`);
console.log(`ブランチ: ${branch}`);
console.log(`ディレクトリ: docs/specs/${id}`);
console.log(`モード: ${mode}`);
if (branch !== branch.toLowerCase()) {
  console.log("[警告] ブランチ名に大文字が含まれています。ブランチ名はすべて小文字にしてください");
}
