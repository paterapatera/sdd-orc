/**
 * 品質ゲート（config.ts の commands）を決まった順に実行する。
 * コードの品質は人のコードレビューではなく、このゲートで担保する。
 *
 * 使い方: deno task --config docs/sdd/deno.json gate [--full]
 *   --full  E2E テスト（commands.e2e）も実行する。sdd-impl の完了時と sdd-finish の開始時に使う
 *
 * 順序: format（自動整形）→ check（無ければ lint、typecheck）→ build → test →（--full のとき）e2e
 *   - format は最初に実行し、失敗しても続ける（整形の結果を check で確かめるため）
 *   - それ以外は、失敗しても残りを実行して、失敗をまとめて報告する
 *
 * 終了コード: すべて成功なら0、失敗があれば1。commands が1つも無ければ0（警告を表示する）。
 */
import { loadConfig } from "./lib/config.ts";
import { ROOT } from "./lib/paths.ts";

const { commands = {} } = await loadConfig();
const full = Deno.args.includes("--full");
const steps: [string, string | undefined][] = [
  ["format", commands.format],
  ...(commands.check ? [["check", commands.check]] as [string, string][] : [
    ["lint", commands.lint] as [string, string | undefined],
    ["typecheck", commands.typecheck] as [string, string | undefined],
  ]),
  ["build", commands.build],
  ["test", commands.test],
  ...(full ? [["e2e", commands.e2e]] as [string, string | undefined][] : []),
];
const configured = steps.filter((s): s is [string, string] => !!s[1]);

if (configured.length === 0) {
  console.log("[警告] 品質ゲートが設定されていません（docs/sdd/config.ts の commands が空です）");
  console.log("       propose-quality-tools でツールを選び、commands に format、check、test などを登録してください");
  Deno.exit(0);
}

const shell = Deno.build.os === "windows" ? ["cmd", "/c"] : ["sh", "-c"];
const results: { name: string; cmd: string; ok: boolean }[] = [];
for (const [name, cmd] of configured) {
  console.log(`\n▶ ${name}: ${cmd}`);
  const { code } = await new Deno.Command(shell[0], {
    args: [shell[1], cmd],
    cwd: ROOT,
    stdout: "inherit",
    stderr: "inherit",
  }).output();
  results.push({ name, cmd, ok: code === 0 });
}

const missing = steps.filter(([, cmd]) => !cmd).map(([name]) => name).filter((n) => n !== "build");
if (!full && commands.e2e) console.log("\n（E2E テストは含めていません。完了時は --full で実行する）");
console.log("\n■ 品質ゲートの結果");
for (const r of results) console.log(`  ${r.ok ? "✓" : "✕"} ${r.name}: ${r.cmd}`);
if (missing.length) console.log(`  ! 未設定: ${missing.join("、")}`);
const failed = results.filter((r) => !r.ok);
console.log(failed.length ? `\n失敗が ${failed.length} 件あります` : "\nすべて成功しました");
Deno.exit(failed.length ? 1 : 0);
