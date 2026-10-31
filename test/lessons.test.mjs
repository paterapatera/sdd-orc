import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { cliPath, initRepo, run, sdd, tempRepo, writeSteering } from "./helpers.mjs";

function read(dir, rel) {
  return fs.readFileSync(path.join(dir, rel), "utf8");
}

function sampleLesson(slug, status = "candidate") {
  return `# Sample lesson

## What happened

Tests failed because the default port was already in use locally.

## Why

Two services assumed the same implicit port.

## Policy

Document the canonical dev port in steering; do not rely on ad hoc ports.

## Occurrences

1

## Related issues

demo-issue

## Status

${status}

## Reason



## Target

steering
`;
}

test("init creates lessons index and root links lessons", () => {
  const dir = tempRepo();
  assert.equal(initRepo(dir).status, 0);
  assert.match(read(dir, "docs/knowledge/lessons/index.md"), /Lessons/);
  assert.match(read(dir, "docs/knowledge/index.md"), /\/lessons\//);
});

test("update and migrate add lessons index on older installs", () => {
  const dir = tempRepo();
  assert.equal(initRepo(dir).status, 0);
  fs.rmSync(path.join(dir, "docs/knowledge/lessons"), { recursive: true, force: true });
  assert.equal(run([cliPath, "update"], dir).status, 0);
  assert.match(read(dir, "docs/knowledge/lessons/index.md"), /Lessons/);
  fs.rmSync(path.join(dir, "docs/knowledge/lessons"), { recursive: true, force: true });
  const migrated = run([cliPath, "migrate"], dir);
  assert.equal(migrated.status, 0);
  assert.match(migrated.stdout, /lessons\/index/);
  assert.match(read(dir, "docs/knowledge/lessons/index.md"), /Lessons/);
});

test("check validates lesson pages and index", () => {
  const dir = tempRepo();
  assert.equal(initRepo(dir).status, 0);
  writeSteering(dir);
  const lessonsDir = path.join(dir, "docs/knowledge/lessons");
  fs.writeFileSync(path.join(lessonsDir, "implicit-port.md"), sampleLesson("implicit-port"));
  const healed = sdd(dir, ["check"]);
  assert.equal(healed.status, 0, healed.stdout);
  assert.match(read(dir, "docs/knowledge/lessons/index.md"), /implicit-port/);
  fs.writeFileSync(path.join(lessonsDir, "implicit-port.md"), sampleLesson("implicit-port").replace("## Target\n\nsteering", "## Target\n\nnot-a-target"));
  const badTarget = sdd(dir, ["check"]);
  assert.equal(badTarget.status, 1);
  assert.match(badTarget.stdout, /LESSONS_TARGET/);
});

test("check rejects invalid lesson status and target", () => {
  const dir = tempRepo();
  assert.equal(initRepo(dir).status, 0);
  writeSteering(dir);
  const file = path.join(dir, "docs/knowledge/lessons/bad-lesson.md");
  fs.writeFileSync(file, sampleLesson("bad-lesson").replace("candidate", "unknown"));
  fs.writeFileSync(path.join(dir, "docs/knowledge/lessons/index.md"), read(dir, "docs/knowledge/lessons/index.md") + "\n* [Bad](/lessons/bad-lesson/) - x\n");
  const result = sdd(dir, ["check"]);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /LESSONS_STATUS/);
});
