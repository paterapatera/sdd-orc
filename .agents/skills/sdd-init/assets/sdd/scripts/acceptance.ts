/**
 * 受け入れテストの準備（spec の acceptanceGuide）を実際に実行して確かめる。
 * sdd-impl は、これが通るまで人に受け入れテストを頼まない（試行で、AIが動かさずに頼み、build の失敗、
 * マイグレーションの漏れ、データの件数の誤りが人の受け入れテストで見つかったため）。
 *
 * 使い方: deno task --config docs/sdd/deno.json acceptance <ISSUE> [--skip-setup]
 *   --skip-setup  setup と data を実行せず、server の起動と check だけを行う
 *
 * 順序: setup（上から順に）→ data → server の起動（あれば）→ check の URL を確かめる → server を止める
 * 1つでも失敗すれば終了コード1で終わる。
 */
import { loadIssue } from "./lib/load.ts";
import { ROOT } from "./lib/paths.ts";

const id = Deno.args.find((a) => !a.startsWith("--"));
const skipSetup = Deno.args.includes("--skip-setup");
if (!id) {
  console.error("使い方: deno task acceptance <ISSUE> [--skip-setup]");
  Deno.exit(1);
}

const issue = await loadIssue(id);
const guide = issue.tasks?.acceptanceGuide ?? issue.quick?.acceptanceGuide;
if (!guide) {
  console.error(`docs/specs/${id} に受け入れテストの準備（acceptanceGuide）がありません`);
  Deno.exit(1);
}

const shell = Deno.build.os === "windows" ? ["cmd", "/c"] : ["sh", "-c"];
const results: { step: string; ok: boolean; detail?: string }[] = [];

async function run(label: string, cmd: string): Promise<boolean> {
  console.log(`\n▶ ${label}: ${cmd}`);
  const { code } = await new Deno.Command(shell[0], {
    args: [shell[1], cmd],
    cwd: ROOT,
    stdout: "inherit",
    stderr: "inherit",
  })
    .output();
  results.push({ step: `${label}: ${cmd}`, ok: code === 0, detail: code === 0 ? undefined : `終了コード ${code}` });
  return code === 0;
}

function finish(): never {
  console.log("\n■ 受け入れテストの準備の確認");
  for (const r of results) console.log(`  ${r.ok ? "✓" : "✕"} ${r.step}${r.detail ? `（${r.detail}）` : ""}`);
  const failed = results.filter((r) => !r.ok).length;
  console.log(
    failed
      ? `\n失敗が ${failed} 件あります。直してから受け入れテストを頼む（人の手元でも同じ手順で失敗する）`
      : "\nすべて確かめました。受け入れテストを頼めます",
  );
  Deno.exit(failed ? 1 : 0);
}

if (!skipSetup) {
  for (const s of guide.setup) {
    if (!(await run("setup", s.run))) finish();
  }
  for (const d of guide.data) {
    if (!(await run(`data（${d.acs.join("、")}）`, d.run))) finish();
    console.log(`  期待する状態: ${d.expect}`);
  }
}

let server: Deno.ChildProcess | undefined;
if (guide.server) {
  console.log(`\n▶ server: ${guide.server.run}`);
  server = new Deno.Command(shell[0], {
    args: [shell[1], `exec ${guide.server.run}`],
    cwd: ROOT,
    stdout: "null",
    stderr: "null",
  }).spawn();
  const deadline = Date.now() + (guide.server.timeoutSec ?? 60) * 1000;
  let up = false;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(guide.server.url, { redirect: "manual" });
      await res.body?.cancel();
      up = true;
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  results.push({ step: `server: ${guide.server.url}`, ok: up, detail: up ? undefined : "応答がありません" });
}

for (const c of guide.check) {
  const expected = c.status ?? 200;
  try {
    const res = await fetch(c.url, { redirect: "manual" });
    const body = await res.text();
    const okStatus = res.status === expected;
    const okBody = !c.contains || body.includes(c.contains);
    results.push({
      step: `check: GET ${c.url}`,
      ok: okStatus && okBody,
      detail: !okStatus
        ? `状態コード ${res.status}（期待は ${expected}）`
        : !okBody
        ? `本文に「${c.contains}」がありません`
        : undefined,
    });
  } catch (e) {
    results.push({ step: `check: GET ${c.url}`, ok: false, detail: e instanceof Error ? e.message : String(e) });
  }
}

if (server) {
  try {
    server.kill("SIGTERM");
    await server.status;
  } catch {
    // 止まっていれば何もしない
  }
}
finish();
