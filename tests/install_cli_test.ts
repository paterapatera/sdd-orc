import * as io from "../harness/io.ts";
import { test } from "bun:test";
import { assert, assertEquals, assertRejects, assertStringIncludes } from "./assert.ts";
import { symlink } from "node:fs/promises";
import { join } from "node:path";
import { installSkills, MANIFEST_NAME } from "../cli/install.mjs";
import { REPO } from "./helpers.ts";

const SOURCE = join(REPO, ".agents/skills");

async function exists(path: string) {
  try {
    await io.stat(path);
    return true;
  } catch {
    return false;
  }
}

async function skillNames(): Promise<string[]> {
  const names: string[] = [];
  for await (const entry of io.readDir(SOURCE)) {
    if (entry.isDirectory && (await exists(join(SOURCE, entry.name, "SKILL.md")))) names.push(entry.name);
  }
  return names.sort();
}

test("既定では .agents にスキルが入り、.cursor のスキルは入らない", async () => {
  const root = await io.makeTempDir({ prefix: "sdd-cli-" });
  const names = await skillNames();
  assert(names.length > 0);
  await installSkills({ dir: root, sourceDir: SOURCE });
  for (const name of names) {
    assert(await exists(join(root, ".agents/skills", name, "SKILL.md")), name);
  }
  assert(await exists(join(root, ".agents/skills/sdd-init/scripts/install.ts")));
  assertEquals(await exists(join(root, ".claude")), false);
  assertEquals(await exists(join(root, ".agents/skills/optimize-fix")), false);
  assertEquals(await exists(join(root, ".cursor/skills/close-pattern")), false);
  const manifest = JSON.parse(await io.readTextFile(join(root, ".agents/skills", MANIFEST_NAME)));
  assertEquals(manifest.skills, names);
});

test("--agent の名前がドットディレクトリになる", async () => {
  const root = await io.makeTempDir({ prefix: "sdd-cli-" });
  await installSkills({ dir: root, sourceDir: SOURCE, agents: ["cursor", "hoge"] });
  assert(await exists(join(root, ".cursor/skills/sdd-init/SKILL.md")));
  assert(await exists(join(root, ".hoge/skills/sdd-init/SKILL.md")));
  assertEquals(await exists(join(root, ".agents")), false);
});

test("エージェント名にパスは使えない", async () => {
  const root = await io.makeTempDir({ prefix: "sdd-cli-" });
  await assertRejects(() => installSkills({ dir: root, sourceDir: SOURCE, agents: ["../hoge"] }), Error, "不正");
  assertEquals(await exists(join(root, ".agents")), false);
});

test("再実行は中身を置き直し、無関係なスキルは残し、外したスキルは消す", async () => {
  const root = await io.makeTempDir({ prefix: "sdd-cli-" });
  const skillsDir = join(root, ".cursor/skills");
  await installSkills({ dir: root, sourceDir: SOURCE, agents: ["cursor"] });
  await io.writeTextFile(join(skillsDir, "sdd-init/SKILL.md"), "古い\n");
  await io.mkdir(join(skillsDir, "local-only"), { recursive: true });
  await io.writeTextFile(join(skillsDir, "local-only/SKILL.md"), "残す\n");
  await io.mkdir(join(skillsDir, "gone"), { recursive: true });
  await io.writeTextFile(join(skillsDir, "gone/SKILL.md"), "消す\n");
  const manifestPath = join(skillsDir, MANIFEST_NAME);
  const manifest = JSON.parse(await io.readTextFile(manifestPath));
  manifest.skills.push("gone");
  await io.writeTextFile(manifestPath, JSON.stringify(manifest));

  const { changes } = await installSkills({ dir: root, sourceDir: SOURCE, agents: ["cursor"] });
  assertEquals(
    await io.readTextFile(join(skillsDir, "sdd-init/SKILL.md")),
    await io.readTextFile(join(SOURCE, "sdd-init/SKILL.md")),
  );
  assertEquals(await io.readTextFile(join(skillsDir, "local-only/SKILL.md")), "残す\n");
  assertEquals(await exists(join(skillsDir, "gone")), false);
  assert(changes.some((change) => change.action === "削除" && change.target === ".cursor/skills/gone"));
});

test("--dry-run はファイルを書かない", async () => {
  const root = await io.makeTempDir({ prefix: "sdd-cli-" });
  const { changes } = await installSkills({ dir: root, sourceDir: SOURCE, dryRun: true });
  assert(changes.some((change) => change.action === "追加"));
  assertEquals(await exists(join(root, ".agents")), false);
  assertEquals(await exists(join(root, ".claude")), false);
});

test("--global はホームの .agents へ入れる", async () => {
  const home = await io.makeTempDir({ prefix: "sdd-cli-home-" });
  const { base } = await installSkills({ global: true, home, sourceDir: SOURCE });
  assertEquals(base, home);
  assert(await exists(join(home, ".agents/skills/sdd-init/SKILL.md")));
  assertEquals(await exists(join(home, ".claude")), false);
});

test("インストール先が正本と同じときは何も消さない", async () => {
  await assertRejects(() => installSkills({ dir: REPO, sourceDir: SOURCE, dryRun: true }), Error, "正本");
  assert(await exists(join(SOURCE, "sdd-init/SKILL.md")));
});

test("node_modules/.bin 経由の symlink でも CLI が動く", async () => {
  const root = await io.makeTempDir({ prefix: "sdd-cli-" });
  const binDir = join(root, "bin");
  const cli = join(REPO, "cli/install.mjs");
  await io.mkdir(binDir, { recursive: true });
  const shim = join(binDir, "sdd-orc");
  await symlink(cli, shim);
  const result = await new io.Command("node", {
    args: [shim, "--dry-run", "--dir", root, "--agent", "cursor"],
    cwd: root,
    stdout: "piped",
    stderr: "piped",
  }).output();
  const out = new TextDecoder().decode(result.stdout);
  const err = new TextDecoder().decode(result.stderr);
  assertEquals(result.code, 0, err);
  assertStringIncludes(out, "追加 .cursor/skills/sdd-init");
});

test("node から --dry-run すると追加予定だけを表示する", async () => {
  const root = await io.makeTempDir({ prefix: "sdd-cli-" });
  const result = await new io.Command("node", {
    args: ["cli/install.mjs", "--dry-run", "--dir", root, "--agent", "cursor"],
    cwd: REPO,
    stdout: "piped",
    stderr: "piped",
  }).output();
  const out = new TextDecoder().decode(result.stdout);
  const err = new TextDecoder().decode(result.stderr);
  assertEquals(result.code, 0, err);
  assertStringIncludes(out, "追加 .cursor/skills/sdd-init");
  assertEquals(out.includes(".agents/"), false);
  assertEquals(await exists(join(root, ".agents")), false);
});
