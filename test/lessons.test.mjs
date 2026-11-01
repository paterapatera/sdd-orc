import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { cliPath, initRepo, run, sdd, tempRepo, writeInvoiceIssue, writeSteering, commitAll, git } from "./helpers.mjs";
import {
  parseFixItems,
  parseFeedbackEntries,
  validateCloseLessons,
  TRIAL_TO_EFFECTIVE_ISSUE_COUNT,
  parseLastReviewedDate,
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



## Last reviewed



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

const MULTI_FEEDBACK = `# Feedback

## 2026-11-01 sdd-req — off-script-answer

質問…以外の答えがあった。

- Lessons: excluded: 自由回答の時刻基準はこの課題で聞き直し、一般の方針にはしない

## 2026-11-01 sdd-req — review-gap

時の数値範囲が無く…

- Lessons: bound-the-unit
`;

const TRIPLE_FEEDBACK = `# Feedback

## 2026-11-01 sdd-req — a

First body.

- Lessons: excluded: one-off

## 2026-11-02 sdd-impl — b

Second body.

- Lessons: excluded: env-only

## 2026-11-03 sdd-close — c

Third body.

- Lessons: slug-three
`;

test("parseFeedbackEntries keeps body lines for every section", () => {
  const two = parseFeedbackEntries(MULTI_FEEDBACK);
  assert.equal(two.length, 2);
  assert.match(two[0].lines.join("\n"), /Lessons: excluded: 自由回答/);
  assert.match(two[1].lines.join("\n"), /Lessons: bound-the-unit/);
  const three = parseFeedbackEntries(TRIPLE_FEEDBACK);
  assert.equal(three.length, 3);
  assert.match(three[0].lines.join("\n"), /First body/);
  assert.match(three[1].lines.join("\n"), /Second body/);
  assert.match(three[2].lines.join("\n"), /Lessons: slug-three/);
  assert.equal(parseFeedbackEntries("# Feedback\n\nPreamble only\n").length, 0);
});

test("validateCloseLessons checks each feedback section independently", () => {
  const config = { docsDir: "docs" };
  const map = new Map([["docs/knowledge/lessons/bound-the-unit.md", sampleLesson("bound-the-unit")]]);
  const base = MULTI_FEEDBACK;
  const allOk = [];
  validateCloseLessons(config, "feat", { feedback: base, task: "" }, map, allOk, "docs/knowledge");
  assert.equal(allOk.length, 0);

  const missingFirst = base.replace("\n- Lessons: excluded: 自由回答", "\n");
  const diagsFirst = [];
  validateCloseLessons(config, "feat", { feedback: missingFirst, task: "" }, map, diagsFirst, "docs/knowledge");
  assert.equal(diagsFirst.length, 1);
  assert.match(diagsFirst[0].message, /off-script-answer/);

  const missingLast = base.replace("\n- Lessons: bound-the-unit", "\n");
  const diagsLast = [];
  validateCloseLessons(config, "feat", { feedback: missingLast, task: "" }, map, diagsLast, "docs/knowledge");
  assert.equal(diagsLast.length, 1);
  assert.match(diagsLast[0].message, /review-gap/);
});

test("close check passes with multi-section feedback dispositions", () => {
  const dir = tempRepo();
  assert.equal(initRepo(dir).status, 0);
  writeSteering(dir);
  git(["checkout", "-b", "multi-feedback"], dir);
  const issue = path.join(dir, "docs/issues/multi-feedback");
  fs.mkdirSync(issue, { recursive: true });
  fs.writeFileSync(
    path.join(issue, "proposal.md"),
    `# Multi feedback\n\n## Why\nx\n\n## What Changes\n- y\n\n## Impact\n- Type: chore\n- Capabilities: none\n- Steering: none\n- Decisions: none\n- Code: none\n\n## Out of Scope\nn\n`,
  );
  fs.writeFileSync(path.join(issue, "task.md"), "# Tasks\n\n- [x] 1. Done\n");
  fs.writeFileSync(path.join(issue, "feedback.md"), MULTI_FEEDBACK);
  fs.writeFileSync(path.join(dir, "docs/knowledge/lessons/bound-the-unit.md"), sampleLesson("bound-the-unit"));
  commitAll(dir, "docs: multi feedback");
  assert.equal(sdd(dir, ["apply", "--issue", "multi-feedback"]).status, 0);
  sdd(dir, ["index"]);
  const ok = sdd(dir, ["check", "--stage", "close", "--issue", "multi-feedback"]);
  assert.equal(ok.status, 0, ok.stdout);
});

test("parseFixItems keeps Lessons line on each Fix block", () => {
  const task = `- [x] 1. Fix: first
  - Lessons: slug-a
- [x] 2. Fix: second
  - Lessons: excluded: one-off
`;
  const fixes = parseFixItems(task);
  assert.equal(fixes.length, 2);
  assert.match(fixes[0].lines.join("\n"), /Lessons: slug-a/);
  assert.match(fixes[1].lines.join("\n"), /Lessons: excluded/);
});

const MIXED_FIX_TASK = `# Tasks

- [x] 1. Implement feature
  - [x] 1.1. Wire API
- [x] 2. Fix: wrong default port
  - Requirements: REQ-1
  - Lessons: fix-port
- [x] 3. Manual verification (P)
- [x] 4. Regression pass
  - [x] 4.1. Fix: nested checklist miss
    - Lessons: fix-nested
- [x] 5. Fix: stale cache
  - Lessons: excluded: one-off cache
`;

test("parseFixItems isolates each top-level Fix among normal tasks", () => {
  const fixes = parseFixItems(MIXED_FIX_TASK);
  assert.equal(fixes.length, 2);
  assert.equal(fixes[0].line, 5);
  assert.match(fixes[0].lines.join("\n"), /fix-port/);
  assert.doesNotMatch(fixes[0].lines.join("\n"), /fix-nested/);
  assert.equal(fixes[1].line, 12);
  assert.match(fixes[1].lines.join("\n"), /excluded: one-off cache/);
});

test("nested Fix minors do not require their own Lessons disposition", () => {
  const nestedOnly = `# Tasks

- [x] 1. Regression
  - [x] 1.1. Fix: nested miss
    - Lessons: orphan-nested
`;
  assert.equal(parseFixItems(nestedOnly).length, 0);
  const config = { docsDir: "docs" };
  const diags = [];
  validateCloseLessons(config, "feat", { feedback: "", task: nestedOnly }, new Map(), diags, "docs/knowledge");
  assert.equal(diags.length, 0);

  const topWithNested = `# Tasks

- [x] 1. Fix: parent
  - [x] 1.1. Fix: detail
  - Lessons: parent-slug
`;
  const fixes = parseFixItems(topWithNested);
  assert.equal(fixes.length, 1);
  assert.match(fixes[0].lines.join("\n"), /parent-slug/);
  assert.match(fixes[0].lines.join("\n"), /1\.1\. Fix:/);
  const ok = [];
  validateCloseLessons(
    config,
    "feat",
    { feedback: "", task: topWithNested },
    new Map([["docs/knowledge/lessons/parent-slug.md", sampleLesson("parent-slug")]]),
    ok,
    "docs/knowledge",
  );
  assert.equal(ok.length, 0);
  const missing = topWithNested.replace("- Lessons: parent-slug", "");
  const fail = [];
  validateCloseLessons(config, "feat", { feedback: "", task: missing }, new Map(), fail, "docs/knowledge");
  assert.equal(fail.length, 1);
  assert.equal(fail[0].line, 3);
});

test("validateCloseLessons reports missing top-level Fix disposition at that Fix line only", () => {
  const config = { docsDir: "docs" };
  const map = new Map([
    ["docs/knowledge/lessons/fix-port.md", sampleLesson("fix-port")],
    ["docs/knowledge/lessons/fix-nested.md", sampleLesson("fix-nested")],
  ]);
  const ok = [];
  validateCloseLessons(config, "feat", { feedback: "", task: MIXED_FIX_TASK }, map, ok, "docs/knowledge");
  assert.equal(ok.length, 0);

  const missingSecond = MIXED_FIX_TASK.replace("  - Lessons: excluded: one-off cache", "");
  const diagsSecond = [];
  validateCloseLessons(config, "feat", { feedback: "", task: missingSecond }, map, diagsSecond, "docs/knowledge");
  assert.equal(diagsSecond.length, 1);
  assert.equal(diagsSecond[0].line, 12);
  assert.match(diagsSecond[0].rule, /LESSONS_UNPROCESSED/);

  const missingFirst = MIXED_FIX_TASK.replace("  - Lessons: fix-port", "");
  const diagsFirst = [];
  validateCloseLessons(config, "feat", { feedback: "", task: missingFirst }, map, diagsFirst, "docs/knowledge");
  assert.equal(diagsFirst.length, 1);
  assert.equal(diagsFirst[0].line, 5);
});

test("lessons index lists every page in slug order and flags stale or missing entries", () => {
  const dir = tempRepo();
  assert.equal(initRepo(dir).status, 0);
  writeSteering(dir);
  const lessonsDir = path.join(dir, "docs/knowledge/lessons");
  fs.writeFileSync(path.join(lessonsDir, "alpha-lesson.md"), sampleLesson("alpha-lesson"));
  fs.writeFileSync(path.join(lessonsDir, "beta-lesson.md"), sampleLesson("beta-lesson"));
  fs.writeFileSync(path.join(lessonsDir, "gamma-lesson.md"), sampleLesson("gamma-lesson"));
  sdd(dir, ["index"]);
  const indexed = read(dir, "docs/knowledge/lessons/index.md");
  const alphaPos = indexed.indexOf("/lessons/alpha-lesson/");
  const betaPos = indexed.indexOf("/lessons/beta-lesson/");
  const gammaPos = indexed.indexOf("/lessons/gamma-lesson/");
  assert.ok(alphaPos >= 0 && betaPos >= 0 && gammaPos >= 0);
  assert.ok(alphaPos < betaPos && betaPos < gammaPos);
  fs.writeFileSync(
    path.join(lessonsDir, "index.md"),
    indexed.replace("* [Sample lesson](/lessons/beta-lesson/)", "* [Stale only](/lessons/stale-only/)"),
  );
  assert.match(sdd(dir, ["check", "--scope", "knowledge"]).stdout, /LESSONS_INDEX/);
  fs.writeFileSync(path.join(lessonsDir, "index.md"), indexed.replace(/\* \[Sample lesson\]\(\/lessons\/gamma-lesson\/\)[^\n]*\n/, ""));
  assert.match(sdd(dir, ["check", "--scope", "knowledge"]).stdout, /LESSONS_INDEX/);
});

test("multiple Occurrence log and Review closes lines validate independently", () => {
  const dir = tempRepo();
  assert.equal(initRepo(dir).status, 0);
  writeSteering(dir);
  let body = sampleLesson("multi-log");
  body = body.replace(
    "## Occurrence log\n\n- 2026-01-15: Local dev port clash during tests.",
    "## Occurrence log\n\n- 2026-01-01: First event.\n- 2026-01-10: Second event.\n- 2026-01-15: Third event.",
  );
  body = body.replace("## Occurrences\n\n1", "## Occurrences\n\n3");
  body = body.replace(
    "## Review closes\n\n\n\n## Last reviewed",
    "## Review closes\n\n- 2026-02-01\n- 2026-02-02\n- 2026-02-03\n\n## Last reviewed",
  );
  fs.writeFileSync(path.join(dir, "docs/knowledge/lessons/multi-log.md"), body);
  sdd(dir, ["index"]);
  assert.equal(sdd(dir, ["check", "--scope", "knowledge"]).status, 0);
  body = body.replace("- 2026-01-10: Second event.", "- 2026-01-10 bad line without colon");
  fs.writeFileSync(path.join(dir, "docs/knowledge/lessons/multi-log.md"), body);
  assert.match(sdd(dir, ["check", "--scope", "knowledge"]).stdout, /LESSONS_OCCURRENCE_LOG/);
  body = body.replace("- 2026-01-10 bad line without colon", "- 2026-01-10: Second event.");
  body = body.replace("- 2026-02-02", "- not-a-date");
  fs.writeFileSync(path.join(dir, "docs/knowledge/lessons/multi-log.md"), body);
  assert.match(sdd(dir, ["check", "--scope", "knowledge"]).stdout, /LESSONS_REVIEW_CLOSES/);
});

test("close check with three feedback entries requires each disposition", () => {
  const dir = tempRepo();
  assert.equal(initRepo(dir).status, 0);
  writeSteering(dir);
  git(["checkout", "-b", "triple-feedback"], dir);
  const issue = path.join(dir, "docs/issues/triple-feedback");
  fs.mkdirSync(issue, { recursive: true });
  fs.writeFileSync(
    path.join(issue, "proposal.md"),
    `# Triple\n\n## Why\nx\n\n## What Changes\n- y\n\n## Impact\n- Type: chore\n- Capabilities: none\n- Steering: none\n- Decisions: none\n- Code: none\n\n## Out of Scope\nn\n`,
  );
  fs.writeFileSync(path.join(issue, "task.md"), "# Tasks\n\n- [x] 1. Done\n");
  fs.writeFileSync(path.join(issue, "feedback.md"), TRIPLE_FEEDBACK);
  fs.writeFileSync(path.join(dir, "docs/knowledge/lessons/slug-three.md"), sampleLesson("slug-three"));
  commitAll(dir, "docs: triple feedback");
  assert.equal(sdd(dir, ["apply", "--issue", "triple-feedback"]).status, 0);
  sdd(dir, ["index"]);
  assert.equal(sdd(dir, ["check", "--stage", "close", "--issue", "triple-feedback"]).status, 0);

  const missingFirst = TRIPLE_FEEDBACK.replace("\n- Lessons: excluded: one-off", "");
  fs.writeFileSync(path.join(issue, "feedback.md"), missingFirst);
  const fail = sdd(dir, ["check", "--stage", "close", "--issue", "triple-feedback"]);
  assert.equal(fail.status, 1);
  assert.match(fail.stdout, /LESSONS_UNPROCESSED/);
  assert.match(fail.stdout, /docs\/issues\/triple-feedback\/feedback\.md:3:/);
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

test("Last reviewed accepts empty or YYYY-MM-DD and rejects other text", () => {
  const dir = tempRepo();
  assert.equal(initRepo(dir).status, 0);
  writeSteering(dir);
  const file = path.join(dir, "docs/knowledge/lessons/reviewed.md");
  fs.writeFileSync(file, sampleLesson("reviewed").replace("## Last reviewed\n\n\n", "## Last reviewed\n\n2026-11-01\n"));
  sdd(dir, ["index"]);
  assert.equal(sdd(dir, ["check", "--scope", "knowledge"]).status, 0);
  fs.writeFileSync(file, sampleLesson("reviewed").replace("## Last reviewed\n\n\n", "## Last reviewed\n\nnot-a-date\n"));
  assert.match(sdd(dir, ["check", "--scope", "knowledge"]).stdout, /LESSONS_LAST_REVIEWED/);
  assert.equal(parseLastReviewedDate("2026-11-01"), "2026-11-01");
  assert.equal(parseLastReviewedDate(""), "");
  assert.equal(parseLastReviewedDate("bad"), null);
});

test("legacy lesson without Last reviewed section still passes check", () => {
  const dir = tempRepo();
  assert.equal(initRepo(dir).status, 0);
  writeSteering(dir);
  let body = sampleLesson("legacy");
  body = body.replace(/\n## Last reviewed\n\n\n## Status/, "\n## Status");
  fs.writeFileSync(path.join(dir, "docs/knowledge/lessons/legacy.md"), body);
  sdd(dir, ["index"]);
  assert.equal(sdd(dir, ["check", "--scope", "knowledge"]).status, 0, sdd(dir, ["check", "--scope", "knowledge"]).stdout);
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



## Last reviewed



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
