import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import { join } from "node:path";
import { emptyRepo, FIXTURE_SPECS, install, patchFile, REPO, run, task, writeFile } from "./helpers.ts";

const TEMPLATES = join(REPO, ".agents/skills/sdd-init/assets/templates");

async function exists(path: string) {
  try {
    await Deno.stat(path);
    return true;
  } catch {
    return false;
  }
}

Deno.test("初回の導入で道具・設定・.gitignore・hook が揃う", async () => {
  const root = await emptyRepo();
  const r = await install(root);
  assertEquals(r.code, 0, r.out);
  for (
    const f of [
      "schema/mod.ts",
      "scripts/verify.ts",
      "scripts/pre-commit.sh",
      "guides/writing-requirements.md",
      "render/main.ts",
      "deno.json",
      "config.ts",
    ]
  ) {
    assert(await exists(join(root, "docs/sdd", f)), `${f} がありません`);
  }
  assertStringIncludes(await Deno.readTextFile(join(root, ".gitignore")), ".sdd/");
  const hook = join(root, ".git/hooks/pre-commit");
  assertStringIncludes(await Deno.readTextFile(hook), "managed by sdd-init");
  assert(((await Deno.stat(hook)).mode! & 0o111) !== 0, "hook に実行権限がありません");
  // 導入直後の docs/sdd は型チェックを通る
  const check = await task(root, "check");
  assertEquals(check.code, 0, check.out);
});

Deno.test("再実行しても何も変わらない", async () => {
  const root = await emptyRepo();
  await install(root);
  const r = await install(root);
  assertEquals(r.code, 0, r.out);
  assertEquals(/\[(追加|更新|削除)\]/.test(r.out), false, r.out);
  assertStringIncludes(r.out, "変更なし");
});

Deno.test("--dry-run ではファイルを変更しない", async () => {
  const root = await emptyRepo();
  const r = await install(root, "--dry-run");
  assertEquals(r.code, 0, r.out);
  assertStringIncludes(r.out, "[追加]");
  assertEquals(await exists(join(root, "docs/sdd")), false);
  assertEquals(await exists(join(root, ".git/hooks/pre-commit")), false);
});

Deno.test("更新では道具を差し替え、恒久ドキュメントは残す", async () => {
  const root = await emptyRepo();
  await install(root);
  await patchFile(root, "docs/sdd/schema/ids.ts", "export type FrId", "// 手で変えた\nexport type FrId");
  await writeFile(root, "docs/sdd/scripts/old.ts", "// 古いファイル\n");
  await patchFile(root, "docs/sdd/config.ts", `schemaVersion: "0.8.0"`, `schemaVersion: "0.0.1"`);
  await patchFile(root, "docs/sdd/config.ts", `branchPrefix: "feature/"`, `branchPrefix: "topic/"`);
  await writeFile(root, "docs/sdd/architecture.ts", "// プロジェクトの構成\n");

  const r = await install(root);
  assertEquals(r.code, 0, r.out);
  assertStringIncludes(r.out, "[更新] docs/sdd/schema/ids.ts");
  assertStringIncludes(r.out, "[削除] docs/sdd/scripts/old.ts");
  assertStringIncludes(r.out, "schemaVersion 0.0.1 → 0.8.0");
  assertEquals((await Deno.readTextFile(join(root, "docs/sdd/schema/ids.ts"))).includes("手で変えた"), false);
  assertEquals(await exists(join(root, "docs/sdd/scripts/old.ts")), false);
  const config = await Deno.readTextFile(join(root, "docs/sdd/config.ts"));
  assertStringIncludes(config, `schemaVersion: "0.8.0"`);
  assertStringIncludes(config, `branchPrefix: "topic/"`);
  assertEquals(await Deno.readTextFile(join(root, "docs/sdd/architecture.ts")), "// プロジェクトの構成\n");
});

Deno.test("既存の pre-commit hook は上書きしない", async () => {
  const root = await emptyRepo();
  await writeFile(root, ".git/hooks/pre-commit", "#!/bin/sh\necho existing\n");
  const r = await install(root);
  assertEquals(r.code, 2, r.out);
  assertStringIncludes(r.out, "[要対応]");
  assertEquals(await Deno.readTextFile(join(root, ".git/hooks/pre-commit")), "#!/bin/sh\necho existing\n");
  // 道具のコピーは行われている
  assert(await exists(join(root, "docs/sdd/schema/mod.ts")));
});

Deno.test("husky を使っていれば hook を設置せずに案内する", async () => {
  const root = await emptyRepo();
  await writeFile(root, ".husky/pre-commit", "npm test\n");
  const r = await install(root);
  assertEquals(r.code, 2, r.out);
  assertStringIncludes(r.out, "husky が使われています");
  assertEquals(await exists(join(root, ".git/hooks/pre-commit")), false);
});

Deno.test("--hook-only は hook だけを設置する", async () => {
  const root = await emptyRepo();
  const r = await install(root, "--hook-only");
  assertEquals(r.code, 0, r.out);
  assert(await exists(join(root, ".git/hooks/pre-commit")));
  assertEquals(await exists(join(root, "docs/sdd")), false);
});

Deno.test("設置した hook は壊れたspecのコミットを止める", async () => {
  const root = await emptyRepo();
  await install(root);
  for (const f of ["issue.md", "requirements.ts", "design.ts", "tasks.ts"]) {
    await writeFile(root, `docs/specs/EX-001/${f}`, await Deno.readTextFile(join(FIXTURE_SPECS, "EX-001", f)));
  }
  await patchFile(root, "docs/specs/EX-001/tasks.ts", `verifies: ["INV-001"],`, "");
  await run("git", ["add", "."], root);
  const r = await run("git", ["commit", "-q", "-m", "broken"], root);
  assertEquals(r.code, 1, r.out);
  assertStringIncludes(r.out, "specの検証に失敗したため、コミットを中止しました");
});

Deno.test("恒久ドキュメントのひな形は型チェックを通る", async () => {
  const root = await emptyRepo();
  await install(root);
  for (const f of ["architecture.ts", "conventions.ts", "nfr.ts", "adr/ADR-0001.ts"]) {
    await writeFile(root, `docs/sdd/${f}`, await Deno.readTextFile(join(TEMPLATES, f)));
  }
  const r = await task(root, "check");
  assertEquals(r.code, 0, r.out);
});

Deno.test("ルートに package.json があっても docs/sdd の型チェックが通る", async () => {
  const root = await emptyRepo();
  await install(root);
  await writeFile(
    root,
    "package.json",
    `{ "private": true, "type": "module", "devDependencies": { "vite": "^5.0.0" } }\n`,
  );
  const r = await task(root, "check");
  assertEquals(r.code, 0, r.out);
});
