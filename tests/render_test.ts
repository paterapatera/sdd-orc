import { assertEquals, assertStringIncludes } from "@std/assert";
import { makeProject, patchFile, task } from "./helpers.ts";

Deno.test("完全モードのHTMLを生成できる", async () => {
  const root = await makeProject({ specs: ["EX-001"] });
  const r = await task(root, "render", "EX-001");
  assertEquals(r.code, 0, r.out);
  const html = await Deno.readTextFile(`${root}/.sdd/out/EX-001/index.html`);
  // EARSを日本語の文章に組み立てている
  assertStringIncludes(
    html,
    "同じアカウントでログインに5回続けて失敗したとき、システムはそのアカウントを15分間ロックしなければならない。",
  );
  assertStringIncludes(html, "アカウントがロックされている間、システムは");
  // IDはコピーできるバッジになっている
  assertStringIncludes(html, `data-copy="FR-001"`);
  assertStringIncludes(html, `data-copy="AC-003"`);
  // 依存関係の図
  assertStringIncludes(html, "<svg");
  assertStringIncludes(html, "LoginAttemptRepository");
  // 外部のファイルを読み込まない（1ファイルで完結する）
  assertEquals(/<(script|link)[^>]+(src|href)=/.test(html), false);
});

Deno.test("軽量モードのHTMLを生成できる", async () => {
  const root = await makeProject({ specs: ["EX-002"] });
  const r = await task(root, "render", "EX-002");
  assertEquals(r.code, 0, r.out);
  const html = await Deno.readTextFile(`${root}/.sdd/out/EX-002/index.html`);
  assertStringIncludes(html, "根本原因");
  assertStringIncludes(html, "件数表示の開始位置を、ページ番号ではなく常に0から計算している。");
  assertStringIncludes(html, "バグの修正");
});

Deno.test("対応漏れはエラー色で表示される", async () => {
  const root = await makeProject({ specs: ["EX-001"] });
  await patchFile(
    root,
    "docs/specs/EX-001/tasks.ts",
    `verifies: ["AC-001", "AC-002", "AC-003", "AC-004"]`,
    `verifies: ["AC-001", "AC-002", "AC-004"]`,
  );
  const r = await task(root, "render", "EX-001");
  assertEquals(r.code, 0, r.out);
  const html = await Deno.readTextFile(`${root}/.sdd/out/EX-001/index.html`);
  assertStringIncludes(html, "受け入れ条件 AC-003 を検証するテストタスクがありません");
  assertStringIncludes(html, `status-error`);
});

Deno.test("specの文字列はエスケープされる", async () => {
  const root = await makeProject({ specs: ["EX-002"] });
  await patchFile(root, "docs/specs/EX-002/spec.ts", `approach: "`, `approach: "<script>alert(1)</script>`);
  const r = await task(root, "render", "EX-002");
  assertEquals(r.code, 0, r.out);
  const html = await Deno.readTextFile(`${root}/.sdd/out/EX-002/index.html`);
  assertStringIncludes(html, "&lt;script&gt;alert(1)&lt;/script&gt;");
});

Deno.test("原文にコードブロックが含まれていても崩れない", async () => {
  const root = await makeProject({ specs: ["EX-002"] });
  const r = await task(root, "render", "EX-002");
  assertEquals(r.code, 0, r.out);
  const html = await Deno.readTextFile(`${root}/.sdd/out/EX-002/index.html`);
  // 4つのバッククォートの囲みの中にある ``` は、そのまま原文の一部として表示される
  assertStringIncludes(html, "ログ:\n```\nGET /search?q=abc&amp;page=2 -&gt; offset=0\n```</code></pre>");
});

Deno.test("受け入れテストのチェックリストを表示する", async () => {
  const root = await makeProject({ specs: ["EX-001"] });
  const r = await task(root, "render", "EX-001");
  assertEquals(r.code, 0, r.out);
  const html = await Deno.readTextFile(`${root}/.sdd/out/EX-001/index.html`);
  assertStringIncludes(html, `<section id="acceptance"><h2>受け入れテスト</h2>`);
  assertStringIncludes(html, `data-accept-key="EX-001:AC-003"`);
  // 自動テストで確かめるもの（AC-004、INV-001）はチェックリストに載せず、件数だけを示す
  assertEquals(html.includes(`data-accept-key="EX-001:AC-004"`), false);
  assertEquals(html.includes(`data-accept-key="EX-001:INV-001"`), false);
  assertStringIncludes(html, "自動テストで確かめるもの（人の確認は不要）");
  assertStringIncludes(html, "受け入れテストの準備（起動の手順、アカウント、データ）はまだ書かれていません");
  // 受け入れテストは issue より前に置く
  assertEquals(html.indexOf(`id="acceptance"`) < html.indexOf(`id="issue"`), true);
});

Deno.test("十分性の確認（issue との対応、非機能要件の検討、チェックリスト）を表示する", async () => {
  const root = await makeProject({ specs: ["EX-001"] });
  const r = await task(root, "render", "EX-001");
  assertEquals(r.code, 0, r.out);
  const html = await Deno.readTextFile(`${root}/.sdd/out/EX-001/index.html`);
  assertStringIncludes(html, `<h3 id="req-sufficiency">十分性の確認</h3>`);
  assertStringIncludes(html, "5回続けて失敗したら15分間ロックする");
  assertStringIncludes(html, "システム環境・エコロジー");
  assertStringIncludes(html, "データの状態（0件、1件、上限、重複、削除済みなど）");
  assertStringIncludes(html, `<span class="tag">境界値</span>`);
});

Deno.test("設計の十分性（実現方法、守り方、チェックリスト、エラー処理の対応）を表示する", async () => {
  const root = await makeProject({ specs: ["EX-001"] });
  const r = await task(root, "render", "EX-001");
  assertEquals(r.code, 0, r.out);
  const html = await Deno.readTextFile(`${root}/.sdd/out/EX-001/index.html`);
  assertStringIncludes(html, `<h3 id="design-strategy">`);
  assertStringIncludes(html, "login_attempts は account_id を主キーにし");
  assertStringIncludes(html, `<h3 id="design-checklist">設計のチェックリスト</h3>`);
  assertStringIncludes(html, "戻し方（リリースで失敗したときの戻し方、マイグレーションの巻き戻し）");
  assertStringIncludes(html, "要件外の異常");
});
