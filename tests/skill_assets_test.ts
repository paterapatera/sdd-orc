import * as io from "../harness/io.ts";
import { test } from "bun:test";
// 各スキルに同梱したひな形が、型チェックと検証の規則を満たしていることを確かめる
import { assertEquals, assertStringIncludes } from "./assert.ts";
import { join } from "node:path";
import { makeProject, REPO, task, writeFile } from "./helpers.ts";

const SKILLS = join(REPO, ".agents/skills");

test("sdd-quick の spec.ts のひな形は、IDを埋めれば型チェックと検証を通る", async () => {
  const root = await makeProject({ specs: [] });
  const template = await io.readTextFile(join(SKILLS, "sdd-quick/assets/spec-template.ts"));
  await writeFile(root, "docs/specs/EX-100/spec.ts", template.replaceAll("<ID>", "EX-100"));
  await writeFile(root, "docs/specs/EX-100/issue.md", "# EX-100 テスト\n");
  const check = await task(root, "check", "EX-100");
  assertEquals(check.code, 0, check.out);
  const verify = await task(root, "verify", "EX-100");
  assertEquals(verify.code, 0, verify.out);
  assertStringIncludes(verify.out, "エラー 0 件");
});

test("完全モードのひな形（要件・設計・タスク）は、組み合わせると型チェックと検証を通る", async () => {
  const root = await makeProject({ specs: [] });
  const templates: [string, string][] = [
    ["sdd-req/assets/requirements-template.ts", "requirements.ts"],
    ["sdd-design/assets/design-template.ts", "design.ts"],
    ["sdd-tasks/assets/tasks-template.ts", "tasks.ts"],
  ];
  for (const [src, dst] of templates) {
    const text = (await io.readTextFile(join(SKILLS, src)))
      .replaceAll("<ID>", "EX-200")
      .replaceAll("<issue.md の文をそのまま>", "長い名前は省略して表示する")
      .replaceAll("<既存のファイルのパス>", "docs/sdd/config.ts");
    await writeFile(root, `docs/specs/EX-200/${dst}`, text);
  }
  await writeFile(root, "docs/specs/EX-200/issue.md", "# EX-200 テスト\n\n長い名前は省略して表示する。\n");
  const check = await task(root, "check", "EX-200");
  assertEquals(check.code, 0, check.out);
  const verify = await task(root, "verify", "EX-200");
  assertEquals(verify.code, 0, verify.out);
  assertStringIncludes(verify.out, "エラー 0 件");
});

test("SDDのスキルは、明示的に呼び出したときだけ動く設定になっている", async () => {
  for await (const e of io.readDir(SKILLS)) {
    if (!e.isDirectory || !e.name.startsWith("sdd-")) continue;
    const md = await io.readTextFile(join(SKILLS, e.name, "SKILL.md"));
    const front = md.split("---")[1] ?? "";
    assertStringIncludes(front, `name: ${e.name}`, e.name);
    assertStringIncludes(front, "disable-model-invocation: true", e.name);
  }
});

test("SKILL.md と手引きが参照するファイルは、すべて存在する", async () => {
  const guidesDir = join(SKILLS, "sdd-init/assets/sdd/guides");
  const exists = async (p: string) => {
    try {
      await io.stat(p);
      return true;
    } catch {
      return false;
    }
  };
  const missing: string[] = [];
  const docs: [string, string][] = [];
  for await (const e of io.readDir(SKILLS)) {
    if (e.isDirectory && e.name.startsWith("sdd-")) docs.push([e.name, join(SKILLS, e.name, "SKILL.md")]);
  }
  for await (const e of io.readDir(guidesDir)) docs.push([`guides/${e.name}`, join(guidesDir, e.name)]);
  for (const [name, path] of docs) {
    const text = await io.readTextFile(path);
    // docs/sdd/guides/<name>.md
    for (const m of text.matchAll(/docs\/sdd\/guides\/([\w-]+\.md)/g)) {
      if (!(await exists(join(guidesDir, m[1])))) missing.push(`${name}: docs/sdd/guides/${m[1]}`);
    }
    // スキル自身の assets/ と references/（SKILL.md だけ）
    if (name.startsWith("sdd-")) {
      for (const m of text.matchAll(/`((?:assets|references)\/[\w./-]+\.(?:md|ts))`/g)) {
        if (!(await exists(join(SKILLS, name, m[1])))) missing.push(`${name}: ${m[1]}`);
      }
    }
    // .agents/skills/<skill>/<path>
    for (const m of text.matchAll(/\.agents\/skills\/([\w-]+\/[\w./-]+\.(?:md|ts))/g)) {
      if (!(await exists(join(SKILLS, m[1])))) missing.push(`${name}: .agents/skills/${m[1]}`);
    }
  }
  assertEquals(missing, []);
});
