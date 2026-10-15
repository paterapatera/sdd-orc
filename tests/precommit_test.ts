import * as io from "../harness/io.ts";
import { test } from "bun:test";
import { assertEquals, assertStringIncludes } from "./assert.ts";
import { makeProject, patchFile, run, writeFile } from "./helpers.ts";

async function gitProject(specs: string[]): Promise<string> {
  const root = await makeProject({ specs });
  await run("git", ["init", "-q"], root);
  await run("git", ["config", "user.email", "test@example.com"], root);
  await run("git", ["config", "user.name", "test"], root);
  await io.copyFile(`${root}/docs/sdd/scripts/pre-commit.sh`, `${root}/.git/hooks/pre-commit`);
  await io.chmod(`${root}/.git/hooks/pre-commit`, 0o755);
  return root;
}

test("specのファイルがステージされていなければ何もしない", async () => {
  const root = await gitProject(["EX-001"]);
  // 壊れたspecがあっても、ステージされていなければコミットできる
  await patchFile(root, "docs/specs/EX-001/tasks.ts", `verifies: ["INV-001"],`, "");
  await writeFile(root, "src/main.py", "print('hello')\n");
  await run("git", ["add", "src/main.py"], root);
  const r = await run("git", ["commit", "-q", "-m", "src only"], root);
  assertEquals(r.code, 0, r.out);
});

test("正しいspecはコミットできる", async () => {
  const root = await gitProject(["EX-001"]);
  await run("git", ["add", "docs"], root);
  const r = await run("git", ["commit", "-q", "-m", "spec"], root);
  assertEquals(r.code, 0, r.out);
});

test("検証に失敗するspecはコミットを中止する", async () => {
  const root = await gitProject(["EX-001"]);
  await patchFile(root, "docs/specs/EX-001/tasks.ts", `verifies: ["INV-001"],`, "");
  await run("git", ["add", "docs"], root);
  const r = await run("git", ["commit", "-q", "-m", "broken spec"], root);
  assertEquals(r.code, 1, r.out);
  assertStringIncludes(r.out, "specの検証に失敗したため、コミットを中止しました");
});

async function withCommands(root: string, commands: string) {
  await patchFile(root, "docs/sdd/config.ts", "staleBranchDays: 30,", `staleBranchDays: 30,\n  commands: ${commands},`);
}

test("config.ts の品質ゲートが通らなければコミットを中止する", async () => {
  const root = await gitProject([]);
  await withCommands(root, `{ check: "true", test: "exit 7" }`);
  await run("git", ["add", "docs"], root);
  const r = await run("git", ["commit", "-q", "-m", "commands"], root);
  assertEquals(r.code, 1, r.out);
  assertStringIncludes(r.out, "品質ゲート（docs/sdd/config.ts の commands）が通らないため、コミットを中止しました");
});

test("config.ts の品質ゲートが通ればコミットでき、commands を変えなければ次は実行しない", async () => {
  const root = await gitProject([]);
  await withCommands(root, `{ check: "echo c >> check.log", test: "true" }`);
  await run("git", ["add", "docs"], root);
  const r = await run("git", ["commit", "-q", "-m", "commands"], root);
  assertEquals(r.code, 0, r.out);

  await patchFile(root, "docs/sdd/config.ts", "staleBranchDays: 30,", "staleBranchDays: 14,");
  await run("git", ["add", "docs"], root);
  const again = await run("git", ["commit", "-q", "-m", "stale days"], root);
  assertEquals(again.code, 0, again.out);
  assertEquals((await io.readTextFile(`${root}/check.log`)).trim(), "c");
});

/** アプリのコードだけがコミットされた、導入前のリポジトリ（docs/sdd は作業ツリーにだけある） */
async function beforeIntroduction(): Promise<string> {
  const root = await gitProject([]);
  await writeFile(root, "src/main.py", "print('hello')\n");
  await run("git", ["add", "src"], root);
  await run("git", ["commit", "-q", "-m", "app"], root);
  return root;
}

test("導入のコミットに SDD 以外のファイルが含まれていれば中止する", async () => {
  const root = await beforeIntroduction();
  await writeFile(root, "src/main.py", "print('formatted')\n");
  await run("git", ["add", "docs", "src"], root);
  const r = await run("git", ["commit", "-q", "-m", "SDDを導入"], root);
  assertEquals(r.code, 1, r.out);
  assertStringIncludes(r.out, "SDD の導入のコミットに");
  assertStringIncludes(r.out, "  src/main.py");
});

test("導入のコミットは docs/sdd、.agents、.gitignore だけなら通り、導入の後は他のファイルと一緒でもよい", async () => {
  const root = await beforeIntroduction();
  await writeFile(root, ".gitignore", ".sdd/\n");
  await writeFile(root, ".agents/skills/sdd-init/SKILL.md", "skill\n");
  await run("git", ["add", "docs", ".gitignore", ".agents"], root);
  const intro = await run("git", ["commit", "-q", "-m", "SDDを導入"], root);
  assertEquals(intro.code, 0, intro.out);

  await patchFile(root, "docs/sdd/config.ts", "staleBranchDays: 30,", "staleBranchDays: 14,");
  await writeFile(root, "src/main.py", "print('changed')\n");
  await run("git", ["add", "docs", "src"], root);
  const later = await run("git", ["commit", "-q", "-m", "後の変更"], root);
  assertEquals(later.code, 0, later.out);
});

test("型チェックに失敗するspecはコミットを中止する", async () => {
  const root = await gitProject(["EX-001"]);
  await patchFile(root, "docs/specs/EX-001/design.ts", `"FR-002": ["AuthService"],`, "");
  await run("git", ["add", "docs"], root);
  const r = await run("git", ["commit", "-q", "-m", "type error"], root);
  assertEquals(r.code, 1, r.out);
  assertStringIncludes(r.out, "型チェックに失敗したため、コミットを中止しました");
});
