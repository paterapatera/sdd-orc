// 軽量モードの一連の流れを、実際のGitリポジトリで通す
// （AIが判断する部分は、サンプルのspecで置き換える）
import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import { join } from "node:path";
import { emptyRepo, FIXTURE_SPECS, install, sh, task, writeFile } from "./helpers.ts";

async function exists(path: string) {
  try {
    await Deno.stat(path);
    return true;
  } catch {
    return false;
  }
}

Deno.test("軽量モード: 導入から完了処理（specの削除）まで", async () => {
  // sdd-init
  const root = await emptyRepo();
  assertEquals((await install(root)).code, 0);
  await writeFile(root, "src/search/pagination.py", "def start(page, size): return 0\n");
  await sh(root, "add", ".");
  await sh(root, "commit", "-q", "-m", "SDDを導入（docs/sdd）");
  assertEquals((await task(root, "doctor")).code, 0);

  // sdd-start: ブランチを作り、issue.md を取り込む
  await sh(root, "switch", "-q", "-c", "feature/EX-002-search-count");
  await writeFile(root, "docs/specs/EX-002/issue.md", await Deno.readTextFile(join(FIXTURE_SPECS, "EX-002/issue.md")));
  await sh(root, "add", ".");
  await sh(root, "commit", "-q", "-m", "EX-002: issueを取り込み");

  // sdd-quick: spec.ts を作ってコミット（pre-commit hook が検査する）
  const spec = await Deno.readTextFile(join(FIXTURE_SPECS, "EX-002/spec.ts"));
  await writeFile(root, "docs/specs/EX-002/spec.ts", spec);
  await sh(root, "add", ".");
  await sh(root, "commit", "-q", "-m", "EX-002: specを作成（軽量モード）");

  // sdd-impl: 1タスク＝1コミット。コミットのハッシュは spec に書かない（メッセージから自動で求める）
  await writeFile(root, "tests/test_pagination.py", "def test_page2(): assert False\n");
  let s = spec.replace(`status: "todo"`, `status: "done"`);
  await writeFile(root, "docs/specs/EX-002/spec.ts", s);
  await sh(root, "add", ".");
  await sh(root, "commit", "-q", "-m", "EX-002 T-001: 再現テストを書いて失敗することを確かめる");

  // 最後のタスクのコミットで、受け入れテストの準備（人が確かめる受け入れ条件があるため必須）も書く
  await writeFile(root, "src/search/pagination.py", "def start(page, size): return (page - 1) * size\n");
  s = s.replace(`status: "todo"`, `status: "done"`).replace(
    "  tasks: {",
    `  acceptanceGuide: {
    setup: [{ run: "true", note: "依存関係の導入とビルド" }],
    accounts: [],
    data: [{ acs: ["AC-001"], run: "true", expect: "45件のデータがある" }],
    check: [{ url: "http://127.0.0.1:1/search?q=abc" }],
  },
  tasks: {`,
  );
  await writeFile(root, "docs/specs/EX-002/spec.ts", s);
  await sh(root, "add", ".");
  await sh(root, "commit", "-q", "-m", "EX-002 T-002: 開始位置の計算を直す");

  // sdd-finish
  const verify = await task(root, "verify", "--finish", "EX-002");
  assertEquals(verify.code, 0, verify.out);
  const report = await task(root, "finish-report", "EX-002");
  assertEquals(report.code, 0, report.out);
  const next = await task(root, "next", "EX-002");
  assertStringIncludes(next.out, "✓ T-001 再現テストを書いて失敗することを確かめる（");

  const render = await task(root, "render", "EX-002");
  assertEquals(render.code, 0, render.out);
  const html = join(root, ".sdd/out/EX-002/index.html");
  const htmlText = await Deno.readTextFile(html);
  assertStringIncludes(htmlText, "進捗: 2 / 2 件完了");
  assertStringIncludes(htmlText, "45件のデータがある");

  await sh(root, "rm", "-q", "-r", "docs/specs/EX-002");
  await sh(root, "commit", "-q", "-m", "EX-002: specを削除（恒久ドキュメントへ反映済み）");

  // specは消え、HTMLは手元に残り、.sdd/ はコミットされていない
  assertEquals(await exists(join(root, "docs/specs/EX-002")), false);
  assert(await exists(html));
  assertEquals(await sh(root, "ls-files", ".sdd"), "");
  assertStringIncludes((await task(root, "verify")).out, "検証するspecがありません");
});
