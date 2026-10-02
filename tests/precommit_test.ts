import { assertEquals, assertStringIncludes } from "@std/assert";
import { makeProject, patchFile, run, writeFile } from "./helpers.ts";

async function gitProject(specs: string[]): Promise<string> {
  const root = await makeProject({ specs });
  await run("git", ["init", "-q"], root);
  await run("git", ["config", "user.email", "test@example.com"], root);
  await run("git", ["config", "user.name", "test"], root);
  await Deno.copyFile(`${root}/docs/sdd/scripts/pre-commit.sh`, `${root}/.git/hooks/pre-commit`);
  await Deno.chmod(`${root}/.git/hooks/pre-commit`, 0o755);
  return root;
}

Deno.test("specのファイルがステージされていなければ何もしない", async () => {
  const root = await gitProject(["EX-001"]);
  // 壊れたspecがあっても、ステージされていなければコミットできる
  await patchFile(root, "docs/specs/EX-001/tasks.ts", `verifies: ["INV-001"],`, "");
  await writeFile(root, "src/main.py", "print('hello')\n");
  await run("git", ["add", "src/main.py"], root);
  const r = await run("git", ["commit", "-q", "-m", "src only"], root);
  assertEquals(r.code, 0, r.out);
});

Deno.test("正しいspecはコミットできる", async () => {
  const root = await gitProject(["EX-001"]);
  await run("git", ["add", "docs"], root);
  const r = await run("git", ["commit", "-q", "-m", "spec"], root);
  assertEquals(r.code, 0, r.out);
});

Deno.test("検証に失敗するspecはコミットを中止する", async () => {
  const root = await gitProject(["EX-001"]);
  await patchFile(root, "docs/specs/EX-001/tasks.ts", `verifies: ["INV-001"],`, "");
  await run("git", ["add", "docs"], root);
  const r = await run("git", ["commit", "-q", "-m", "broken spec"], root);
  assertEquals(r.code, 1, r.out);
  assertStringIncludes(r.out, "specの検証に失敗したため、コミットを中止しました");
});

Deno.test("型チェックに失敗するspecはコミットを中止する", async () => {
  const root = await gitProject(["EX-001"]);
  await patchFile(root, "docs/specs/EX-001/design.ts", `"FR-002": ["AuthService"],`, "");
  await run("git", ["add", "docs"], root);
  const r = await run("git", ["commit", "-q", "-m", "type error"], root);
  assertEquals(r.code, 1, r.out);
  assertStringIncludes(r.out, "型チェックに失敗したため、コミットを中止しました");
});
