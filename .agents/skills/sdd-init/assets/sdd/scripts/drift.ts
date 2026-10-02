/**
 * architecture.ts が作られた時点（basedOn）から、構成に関わる変更があったかを調べる。
 * SDDを通らないコミットで architecture.ts が古くなっていないかを確かめるために使う。
 *
 * 使い方: deno task --config docs/sdd/deno.json drift
 *
 * 比較先はリモートの既定ブランチ（無ければ HEAD）。構成に関わる変更があっても終了コードは0。
 */
import { loadArchitecture } from "./lib/config.ts";
import { commitExists, defaultRemoteBranch, gitOut, hasRemote } from "./lib/git.ts";
import { isManifest } from "./lib/manifests.ts";

const arch = await loadArchitecture();
if (!arch) {
  console.log("docs/sdd/architecture.ts がありません。sdd-init で作成してください");
  Deno.exit(0);
}
if (!arch.basedOn || arch.basedOn === "none" || arch.basedOn.startsWith("<")) {
  console.log("architecture.ts の basedOn が未設定です（新規案件で、基盤issueの完了前なら問題ありません）");
  Deno.exit(0);
}
if (!(await commitExists(arch.basedOn))) {
  console.log(
    `basedOn のコミット ${arch.basedOn} が見つかりません。git fetch を実行するか、architecture.ts を見直してください`,
  );
  Deno.exit(0);
}

const target = (await hasRemote()) ? (await defaultRemoteBranch()) ?? "HEAD" : "HEAD";
const count = Number(await gitOut(["rev-list", "--count", `${arch.basedOn}..${target}`]) ?? "0");
console.log(`architecture.ts の基準: ${arch.basedOn.slice(0, 10)}（${arch.updatedAt}）`);
console.log(`比較先: ${target}（基準から ${count} コミット）`);
if (count === 0) {
  console.log("\n構成に関わる変更はありません");
  Deno.exit(0);
}

const exclude = [":(exclude)docs/specs", ":(exclude)docs/sdd"];
const nameStatus = (await gitOut(["diff", "--name-status", arch.basedOn, target, "--", ".", ...exclude])) ?? "";
const changes = nameStatus.split("\n").filter(Boolean).map((l) => {
  const [status, ...paths] = l.split("\t");
  return { status: status[0], path: paths[paths.length - 1] };
});

const findings: string[] = [];
for (const c of changes) {
  if (isManifest(c.path)) findings.push(`依存関係の定義が変わった: ${c.path}`);
}

const topDirs = async (rev: string) =>
  new Set(((await gitOut(["ls-tree", "-d", "--name-only", rev])) ?? "").split("\n").filter(Boolean));
const before = await topDirs(arch.basedOn);
const after = await topDirs(target);
for (const d of after) if (!before.has(d)) findings.push(`最上位のディレクトリが増えた: ${d}/`);
for (const d of before) if (!after.has(d)) findings.push(`最上位のディレクトリが無くなった: ${d}/`);

for (const [name, m] of Object.entries(arch.modules)) {
  const found = await gitOut(["ls-tree", "--name-only", target, "--", m.path.replace(/\/$/, "")]);
  if (!found) findings.push(`モジュール ${name} のパス ${m.path} が見つからない`);
}

console.log(`変更されたファイル: ${changes.length} 件（docs/specs と docs/sdd を除く）`);
if (findings.length === 0) {
  console.log("\n構成に関わる変更は見つかりませんでした");
} else {
  console.log("\n構成に関わる変更:");
  for (const f of findings) console.log(`  - ${f}`);
  console.log("\narchitecture.ts の更新を検討してください（コードを正とする）");
}
