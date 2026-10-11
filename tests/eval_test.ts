// 訓練の道具（eval/）: 試験場の準備、採点、チャットの記録の集計
import { assert, assertEquals, assertFalse, assertRejects } from "@std/assert";
import { join } from "node:path";
import {
  analyzeTranscripts,
  defaultPaths,
  gradeRun,
  loadScenario,
  matchesAny,
  type Paths,
  prepareRun,
  readScores,
  summarize,
} from "../eval/lib.ts";
import { emptyRepo, install, REPO, sh, writeFile } from "./helpers.ts";

async function exists(path: string) {
  try {
    await Deno.stat(path);
    return true;
  } catch {
    return false;
  }
}

Deno.test("glob: ** は階層をまたぎ、* は1階層だけに当てはまる", () => {
  assert(matchesAny("app/Models/User.php", ["app/**"]));
  assert(matchesAny("composer.json", ["composer.json"]));
  assert(matchesAny("Modules/Demo/routes/web.php", ["Modules/*/routes/*.php"]));
  assertFalse(matchesAny("Modules/Demo/app/routes/web.php", ["Modules/*/routes/*.php"]));
  assertFalse(matchesAny("composer.lock", ["composer.json"]));
  assertFalse(matchesAny("docs/sdd/app/x.ts", ["app/**"]));
});

Deno.test("チャットの記録: 質問ツールの回数と、2問以上をまとめた回数を数える", () => {
  const ask = (n: number) => ({ type: "tool_use", name: "AskQuestion", input: { questions: Array(n).fill({}) } });
  const text = [
    { role: "user", message: { content: [{ type: "text", text: "/sdd-init" }] } },
    { role: "assistant", message: { content: [{ type: "tool_use", name: "Shell", input: {} }, ask(1)] } },
    { role: "user", message: { content: [{ type: "text", text: "既存案件" }] } },
    { role: "assistant", message: { content: [ask(3)] } },
    {
      role: "assistant",
      message: {
        content: [{
          type: "tool_use",
          name: "CallDynamicTool",
          input: { toolName: "AskQuestion", arguments: { questions: [{}, {}] } },
        }],
      },
    },
  ].map((l) => JSON.stringify(l)).join("\n") + "\n{壊れた行";
  assertEquals(analyzeTranscripts([text]), {
    files: 1,
    userTurns: 2,
    toolCalls: 4,
    askCalls: 3,
    questions: 6,
    multiQuestionAsks: 2,
  });
});

Deno.test("問題: eval/scenarios の問題はすべて読み込める", async () => {
  const paths = defaultPaths();
  for await (const e of Deno.readDir(paths.scenarios)) {
    if (!e.isDirectory) continue;
    const s = await loadScenario(paths, e.name);
    assert(s.checks.length > 0, `${e.name} に確かめる項目がありません`);
  }
});

/** 試験場と問題を一時ディレクトリに作る */
async function setup(): Promise<Paths> {
  const target = await emptyRepo("sdd-eval-target-");
  await writeFile(target, "app/x.php", "<?php\n");
  await writeFile(target, ".agents/skills/old-skill/SKILL.md", "古いスキル\n");
  await sh(target, "add", ".");
  await sh(target, "commit", "-q", "-m", "init");
  await sh(target, "config", "tag.gpgSign", "false");
  await sh(target, "tag", "v0.0.0");

  const work = await Deno.makeTempDir({ prefix: "sdd-eval-" });
  const scenarios = join(work, "scenarios");
  await writeFile(scenarios, "T-001/persona.md", "回答表\n");
  await writeFile(scenarios, "T-001/issue.md", "issue の本文\n");
  await writeFile(scenarios, "T-001/hidden/check.sh", "test -f done.txt\n");
  await writeFile(
    scenarios,
    "T-001/scenario.ts",
    `export default ${
      JSON.stringify({
        id: "T-001",
        title: "テスト",
        split: "train",
        startTag: "v0.0.0",
        steps: ["/sdd-start"],
        issue: "issue.md",
        persona: "persona.md",
        checks: [
          // 整形のように、ファイルを書き換えるコマンド
          {
            id: "fmt",
            kind: "command",
            must: false,
            label: "整形",
            run: "echo '// 整形' >> app/x.php && echo 生成 > fmt-output.txt",
          },
          { id: "done", kind: "exists", must: true, label: "done.txt がある", paths: ["done.txt"] },
          { id: "app", kind: "unchanged", must: true, label: "app を変えない", paths: ["app/**"] },
          { id: "word", kind: "contains", must: false, label: "OK と書く", path: "done.txt", patterns: ["^ok$"] },
          {
            id: "hidden",
            kind: "hiddenTests",
            must: true,
            label: "隠したテスト",
            from: "hidden",
            to: "hidden_tests",
            run: "sh hidden_tests/check.sh",
          },
        ],
      })
    };\n`,
  );
  return { repo: REPO, target, scenarios, runs: join(work, "runs"), branch: "main" };
}

Deno.test("準備: 出発点に戻し、前の実行のブランチと未追跡のファイルと hook を消し、スキルを差し替える", async () => {
  const paths = await setup();
  const t = paths.target;
  await sh(t, "switch", "-q", "-c", "sdd-init");
  await writeFile(t, "app/x.php", "<?php // 前の実行\n");
  await sh(t, "commit", "-q", "-am", "前の実行");
  await writeFile(t, "leftover.txt", "前の実行\n");
  await writeFile(t, ".git/hooks/pre-commit", "#!/bin/sh\n");

  await assertRejects(() => prepareRun(paths, "T-001"), Error, "未コミットの変更");
  const { run, issue } = await prepareRun(paths, "T-001", { force: true, model: "m1" });

  assertEquals(await sh(t, "branch", "--show-current"), "main");
  assertEquals(await sh(t, "for-each-ref", "--format=%(refname:short)", "refs/heads"), "main");
  assertEquals(await Deno.readTextFile(join(t, "app/x.php")), "<?php\n");
  assertFalse(await exists(join(t, "leftover.txt")));
  assertFalse(await exists(join(t, ".git/hooks/pre-commit")));
  assertFalse(await exists(join(t, ".agents/skills/old-skill")));
  assert(await exists(join(t, ".agents/skills/sdd-init/SKILL.md")));
  assertEquals(await sh(t, "status", "--porcelain"), "");
  assert((await sh(t, "log", "-1", "--format=%s")).startsWith("chore: SDD のスキルを差し替え"));
  assertEquals(run.startCommit, await sh(t, "rev-parse", "HEAD"));
  assertEquals(run.model, "m1");
  assertEquals(run.skills.tree, await sh(t, "rev-parse", "HEAD:.agents/skills"));
  assertEquals(issue, "issue の本文\n");
  assertEquals((await Deno.readTextFile(join(paths.runs, "latest"))).trim(), run.runId);
});

Deno.test("準備: origin があれば、既定のブランチを出発点に強制 push し、ほかのリモートのブランチを消す", async () => {
  const paths = await setup();
  const t = paths.target;
  const remote = await Deno.makeTempDir({ prefix: "sdd-eval-remote-" });
  await sh(remote, "init", "-q", "--bare");
  await sh(t, "remote", "add", "origin", remote);
  await writeFile(t, "app/x.php", "<?php // 前の実行\n");
  await sh(t, "commit", "-q", "-am", "前の実行");
  await sh(t, "push", "-q", "origin", "main", "main:refs/heads/gh-1-old");

  const { run } = await prepareRun(paths, "T-001");

  assertEquals(await sh(remote, "rev-parse", "main"), run.startCommit);
  assertEquals(await sh(remote, "for-each-ref", "--format=%(refname:short)", "refs/heads"), "main");
  assertEquals(await sh(t, "rev-parse", "origin/main"), run.startCommit);
  assertEquals(await sh(t, "for-each-ref", "--format=%(refname:short)", "refs/remotes"), "origin/main");
});

Deno.test("採点: 修正より前にテストだけのコミットがあるかを確かめる", async () => {
  const paths = await setup();
  const t = paths.target;
  const file = join(paths.scenarios, "T-001/scenario.ts");
  const src = await Deno.readTextFile(file);
  await Deno.writeTextFile(
    file,
    src.replace(
      `"checks":[`,
      `"checks":[{"id":"tf","kind":"testFirst","must":true,"label":"テストが先","tests":["tests/**"],"code":["app/**"]},`,
    ),
  );
  const commit = async (path: string, msg: string) => {
    await writeFile(t, path, msg + "\n");
    await sh(t, "add", ".");
    await sh(t, "commit", "-q", "-m", msg);
  };
  const tf = async () => (await gradeRun(paths, undefined, { transcripts: [] })).checks.find((c) => c.id === "tf")!;

  await prepareRun(paths, "T-001");
  assertEquals((await tf()).detail, "修正のコミットが無い");
  await commit("docs/specs/X/spec.ts", "spec");
  await commit("app/x.php", "fix");
  assertFalse((await tf()).ok);

  await prepareRun(paths, "T-001", { force: true });
  await commit("docs/specs/X/spec.ts", "spec");
  await commit("tests/x_test.php", "test");
  await commit("app/x.php", "fix");
  assert((await tf()).ok);
});

Deno.test("採点: noCommand は、チャットの記録で禁止したコマンドを実行していれば不合格にする", async () => {
  const paths = await setup();
  const file = join(paths.scenarios, "T-001/scenario.ts");
  const src = await Deno.readTextFile(file);
  await Deno.writeTextFile(
    file,
    src.replace(
      `"checks":[`,
      `"checks":[{"id":"np","kind":"noCommand","must":true,"label":"PR を作らない","patterns":["\\\\bgh\\\\s+pr\\\\s+create\\\\b"]},`,
    ),
  );
  const chat = async (...commands: string[]) => {
    const path = join(await Deno.makeTempDir(), "chat.jsonl");
    const entry = (command: string) =>
      JSON.stringify({
        role: "assistant",
        message: { content: [{ type: "tool_use", name: "Shell", input: { command } }] },
      });
    await Deno.writeTextFile(path, commands.map(entry).join("\n") + "\n");
    return path;
  };
  const np = async (transcripts: string[]) =>
    (await gradeRun(paths, undefined, { transcripts })).checks.find((c) => c.id === "np")!;

  await prepareRun(paths, "T-001");
  assertEquals((await np([])).detail, "チャットの記録が無い");
  assert((await np([await chat("gh pr list", "git push")])).ok);
  const ng = await np([await chat("git push && gh pr create --title x")]);
  assertFalse(ng.ok);
  assertEquals(ng.detail, "実行した: git push && gh pr create --title x");
});

Deno.test("採点: unchanged の allowNew は、新しいファイルの追加を数えず、既存のファイルの変更は数える", async () => {
  const paths = await setup();
  const t = paths.target;
  const file = join(paths.scenarios, "T-001/scenario.ts");
  const src = await Deno.readTextFile(file);
  await Deno.writeTextFile(
    file,
    src.replace(
      `"checks":[`,
      `"checks":[{"id":"keep","kind":"unchanged","must":true,"label":"既存を変えない","paths":["app/**"],"allowNew":true},`,
    ),
  );
  const keep = async () => (await gradeRun(paths, undefined, { transcripts: [] })).checks.find((c) => c.id === "keep")!;

  await prepareRun(paths, "T-001");
  await writeFile(t, "app/new.php", "<?php\n");
  await sh(t, "add", ".");
  await sh(t, "commit", "-q", "-m", "add");
  await writeFile(t, "app/untracked.php", "<?php\n");
  assert((await keep()).ok);

  await writeFile(t, "app/x.php", "<?php // 変更\n");
  assertEquals((await keep()).detail, "変わった: app/x.php");
});

Deno.test("準備: 導入済みの出発点なら道具を今のスキルの版に更新して hook を設置し、導入前なら何もしない", async () => {
  const before = await setup();
  await prepareRun(before, "T-001");
  assertFalse(await exists(join(before.target, ".git/hooks/pre-commit")));
  assertFalse(await exists(join(before.target, "docs/sdd")));

  const after = await setup();
  const t = after.target;
  await install(t);
  await writeFile(t, "docs/sdd/scripts/drift.ts", "// 古い道具\n");
  await sh(t, "add", ".");
  await sh(t, "commit", "-q", "--no-verify", "-m", "SDDを導入");
  await Deno.remove(join(t, ".git/hooks/pre-commit"));
  await sh(t, "tag", "-f", "v0.0.0");

  await prepareRun(after, "T-001");
  assert((await Deno.readTextFile(join(t, ".git/hooks/pre-commit"))).includes("managed by sdd-init"));
  assertEquals(
    await Deno.readTextFile(join(t, "docs/sdd/scripts/drift.ts")),
    await Deno.readTextFile(join(REPO, ".agents/skills/sdd-init/assets/sdd/scripts/drift.ts")),
  );
  assertEquals(await sh(t, "status", "--porcelain"), "");
});

Deno.test("採点: 落ちた項目を理由付きで記録し、隠したテストは終わったら消す", async () => {
  const paths = await setup();
  const t = paths.target;
  const { run } = await prepareRun(paths, "T-001");

  // 1回目: done.txt が無く、app を変えた → 不合格
  await writeFile(t, "app/x.php", "<?php // 変えた\n");
  const transcript = join(await Deno.makeTempDir(), "chat.jsonl");
  await Deno.writeTextFile(transcript, JSON.stringify({ role: "user", message: { content: [] } }) + "\n");
  const ng = await gradeRun(paths, undefined, { transcripts: [transcript] });
  assertFalse(ng.passed);
  const byId = Object.fromEntries(ng.checks.map((c) => [c.id, c]));
  assertFalse(byId.done.ok);
  assertFalse(byId.app.ok);
  assertEquals(byId.app.detail, "変わった: app/x.php");
  assertFalse(byId.hidden.ok);
  assertEquals(ng.checks.map((c) => c.id), ["fmt", "done", "app", "word", "hidden"]);
  // コマンドが書き換えたものは戻し、AI が残した変更は残す
  assertEquals(await Deno.readTextFile(join(t, "app/x.php")), "<?php // 変えた\n");
  assertFalse(await exists(join(t, "fmt-output.txt")));
  assert(await exists(join(paths.runs, run.runId, "logs/hidden.log")));
  assertFalse(await exists(join(t, "hidden_tests")));
  assertEquals(ng.transcript?.userTurns, 1);
  assert(await exists(join(paths.runs, run.runId, "transcripts/chat.jsonl")));

  // 2回目: 整形が app を書き換えても、判定は整形の前に行う。必須の項目だけ満たす → 合格（参考の項目は落ちてよい）
  await sh(t, "checkout", "--", "app/x.php");
  await writeFile(t, "done.txt", "done\n");
  await sh(t, "add", "done.txt");
  await sh(t, "commit", "-q", "-m", "feat: done");
  const ok = await gradeRun(paths, run.runId, { transcripts: [] });
  assert(ok.passed);
  assertEquals(ok.score, 4 / 5);
  assertEquals(await sh(t, "status", "--porcelain"), "");
  assertEquals(ok.commits.map((c) => c.split(" ").slice(1).join(" ")), ["feat: done"]);
  assert(await exists(join(paths.runs, run.runId, "repo.bundle")));

  const summary = summarize(await readScores(paths));
  assert(summary.includes("T-001\ttrain"));
  assert(summary.includes("\t1/1\t"));

  // sdd-orc のコミットが違っても、スキルの中身が同じなら1行にまとめる。中身が違えば分ける
  const graded = (await readScores(paths))[0];
  const base = { ...graded, skills: { commit: "d".repeat(40), dirty: false, tree: "1".repeat(40) } };
  const sameTree = { ...base, runId: "x-2", passed: false, skills: { ...base.skills, commit: "f".repeat(40) } };
  const otherTree = { ...base, runId: "x-3", skills: { ...base.skills, commit: "e".repeat(40), tree: "0".repeat(40) } };
  const merged = summarize([base, sameTree, otherTree]);
  assert(merged.includes("ddddddd=fffffff\t-\t1/2\t"), merged);
  assert(merged.includes("eeeeeee\t-\t1/1\t"), merged);

  // excluded.md を置いた実行は集計から外し、外したことを表示する
  await Deno.writeTextFile(join(paths.runs, run.runId, "excluded.md"), "試験場の環境の問題\n");
  const scores = await readScores(paths);
  assertEquals(scores[0].excluded, "試験場の環境の問題");
  const without = summarize(scores);
  assertFalse(without.includes("T-001\ttrain"));
  assert(without.includes(`集計から外した実行（excluded.md）: ${run.runId}`));
});
