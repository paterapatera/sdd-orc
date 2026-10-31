import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { cliPath, initRepo, run, sdd, tempRepo, writeInvoiceIssue, writeSteering, commitAll, git } from "./helpers.mjs";
import {
  parseFixItems,
  validateCloseLessons,
  TRIAL_TO_EFFECTIVE_ISSUE_COUNT,
} from "../src/script/lessons.mjs";

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

## Occurrence log

- 2026-01-15: Local dev port clash during tests.

## Review closes



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
  assert.match(healed.stdout, /note: LESSONS_INDEX_REGEN/);
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

test("trial to effective threshold is documented in code", () => {
  assert.equal(TRIAL_TO_EFFECTIVE_ISSUE_COUNT, 3);
});

test("validateCloseLessons requires Lessons dispositions", () => {
  const config = { docsDir: "docs", skillsDir: [".agents"], runtime: "node" };
  const diags = [];
  const map = new Map();
  const files = {
    feedback: `# Feedback\n\n## 2026-01-01 sdd-impl — test\n\nPort clash.\n`,
    task: "",
  };
  validateCloseLessons(config, "feat", files, map, diags, "docs/knowledge");
  assert.match(diags[0].rule, /LESSONS_UNPROCESSED/);
  diags.length = 0;
  files.feedback += "\n- Lessons: excluded: environment-only\n";
  validateCloseLessons(config, "feat", files, map, diags, "docs/knowledge");
  assert.equal(diags.length, 0);
});

test("parseFixItems and slug disposition require lesson page", () => {
  const fixes = parseFixItems(`- [x] 1. Fix: wrong default\n  - Lessons: missing-page\n`);
  assert.equal(fixes.length, 1);
  const config = { docsDir: "docs" };
  const diags = [];
  validateCloseLessons(config, "feat", { feedback: "", task: "- [x] 1. Fix: wrong default\n  - Lessons: missing-page\n" }, new Map(), diags, "docs/knowledge");
  assert.match(diags[0].rule, /LESSONS_UNPROCESSED/);
});

test("close check fails on unprocessed feedback then passes with disposition", () => {
  const dir = tempRepo();
  assert.equal(initRepo(dir).status, 0);
  writeSteering(dir);
  git(["checkout", "-b", "invoice-reissue"], dir);
  writeInvoiceIssue(dir);
  fs.writeFileSync(
    path.join(dir, "docs/issues/invoice-reissue/feedback.md"),
    `# Feedback\n\n## 2026-01-01 sdd-impl — port\n\nDev port was taken.\n`,
  );
  commitAll(dir, "docs: proposal");
  assert.equal(sdd(dir, ["apply"]).status, 0);
  const blocked = sdd(dir, ["check", "--stage", "close"]);
  assert.match(blocked.stdout, /LESSONS_UNPROCESSED/);
  const lessonPath = path.join(dir, "docs/knowledge/lessons/dev-port.md");
  fs.writeFileSync(lessonPath, sampleLesson("dev-port"));
  fs.appendFileSync(
    path.join(dir, "docs/issues/invoice-reissue/feedback.md"),
    "\n- Lessons: dev-port\n",
  );
  sdd(dir, ["index"]);
  const ok = sdd(dir, ["check", "--stage", "close"]);
  assert.equal(ok.status, 0, ok.stdout);
});

test("close creates lessons index when directory was missing", () => {
  const dir = tempRepo();
  assert.equal(initRepo(dir).status, 0);
  writeSteering(dir);
  git(["checkout", "-b", "quick-fix"], dir);
  const issue = path.join(dir, "docs/issues/quick-fix");
  fs.mkdirSync(issue, { recursive: true });
  fs.writeFileSync(
    path.join(issue, "proposal.md"),
    `# Quick fix\n\n## Why\nx\n\n## What Changes\n- y\n\n## Impact\n- Type: chore\n- Capabilities: none\n- Steering: none\n- Decisions: none\n- Code: none\n\n## Out of Scope\nnone\n`,
  );
  fs.writeFileSync(path.join(issue, "task.md"), "# Tasks\n\n- [x] 1. Do it\n");
  fs.rmSync(path.join(dir, "docs/knowledge/lessons"), { recursive: true, force: true });
  commitAll(dir, "docs: quick");
  const closed = sdd(dir, ["check", "--stage", "close", "--issue", "quick-fix"]);
  assert.equal(closed.status, 0, closed.stdout);
  assert.match(read(dir, "docs/knowledge/lessons/index.md"), /Lessons/);
});

test("Reason required only for ineffective or rejected", () => {
  const dir = tempRepo();
  assert.equal(initRepo(dir).status, 0);
  writeSteering(dir);
  const file = path.join(dir, "docs/knowledge/lessons/reason-test.md");
  let body = sampleLesson("reason-test", "rejected");
  fs.writeFileSync(file, body);
  sdd(dir, ["index"]);
  const missing = sdd(dir, ["check"]);
  assert.match(missing.stdout, /LESSONS_REASON/);
  body = body.replace("## Reason\n\n\n", "## Reason\n\nHuman declined.\n");
  fs.writeFileSync(file, body);
  assert.equal(sdd(dir, ["check"]).status, 0);
  fs.writeFileSync(file, sampleLesson("reason-test", "trial").replace("## Reason\n\n\n", "## Reason\n\nShould be empty.\n"));
  sdd(dir, ["index"]);
  assert.match(sdd(dir, ["check"]).stdout, /LESSONS_REASON/);
});

test("Occurrences must cover occurrence log entry count", () => {
  const dir = tempRepo();
  assert.equal(initRepo(dir).status, 0);
  writeSteering(dir);
  let body = sampleLesson("occ");
  body = body.replace(
    "## Occurrence log\n\n- 2026-01-15: Local dev port clash during tests.",
    "## Occurrence log\n\n- 2026-01-01: a\n- 2026-01-02: b\n- 2026-01-03: c",
  );
  fs.writeFileSync(path.join(dir, "docs/knowledge/lessons/occ.md"), body);
  sdd(dir, ["index"]);
  assert.match(sdd(dir, ["check"]).stdout, /LESSONS_OCCURRENCES/);
});

test("close check passes with occurrence log and no issue names in lessons", () => {
  const dir = tempRepo();
  assert.equal(initRepo(dir).status, 0);
  writeSteering(dir);
  git(["checkout", "-b", "eval-empty-hint"], dir);
  const issue = path.join(dir, "docs/issues/eval-empty-hint");
  fs.mkdirSync(issue, { recursive: true });
  fs.writeFileSync(
    path.join(issue, "proposal.md"),
    `# 空一覧案内\n\n## Why\nx\n\n## What Changes\n- y\n\n## Impact\n- Type: chore\n- Capabilities: none\n- Steering: none\n- Decisions: none\n- Code: none\n\n## Out of Scope\nn\n`,
  );
  fs.writeFileSync(path.join(issue, "task.md"), "# Tasks\n\n- [x] 1. Done\n");
  fs.writeFileSync(
    path.join(issue, "feedback.md"),
    "# Feedback\n\n## 2026-10-31 sdd-impl — test-stop\nBlank list confused users.\n\n- Lessons: empty-hint\n",
  );
  fs.writeFileSync(
    path.join(dir, "docs/knowledge/lessons/empty-hint.md"),
    `# 空一覧の案内不足

## What happened

公開対象ゼロ件で画面が空白に見えた。

## Why

空状態の方針が steering に無かった。

## Policy

空一覧時は固定案内文を必ず示す。

## Occurrences

1

## Occurrence log

- 2026-10-31: 公開対象ゼロ件で一覧が空白に見えた。

## Review closes



## Status

trial

## Reason



## Target

steering
`,
  );
  commitAll(dir, "docs: eval empty hint");
  const result = sdd(dir, ["check", "--stage", "close", "--issue", "eval-empty-hint"]);
  assert.equal(result.status, 0, result.stdout);
  assert.doesNotMatch(result.stdout, /CLOSE_ISSUE_NAME/);
});
