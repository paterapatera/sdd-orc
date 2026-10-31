/**
 * Laravel-fp-like walkthrough: init → check stages → impl → close.
 * Run: node test/laravel-fixture-walkthrough.mjs
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { cliPath, commitAll, git, initRepo, run, sdd, tempRepo, writeSteering } from "./helpers.mjs";

const log = [];
function step(name, fn) {
  const result = fn();
  log.push({ step: name, status: result.status, stdout: (result.stdout || "").trim(), stderr: (result.stderr || "").trim() });
  return result;
}

const dir = tempRepo();
const init = step("init", () => initRepo(dir, ["--lang", "ja", "--runtime", "bun", "--skills-dir", ".agents", "--base-branch", "main"]));
assert.equal(init.status, 0, init.stderr);

const configPath = path.join(dir, "sdd.config.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
config.testCommand = "./vendor/bin/phpunit";
fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);

fs.mkdirSync(path.join(dir, "vendor/bin"), { recursive: true });
fs.writeFileSync(
  path.join(dir, "vendor/bin/phpunit"),
  "#!/bin/sh\n# Laravel-fp stand-in when PHP is unavailable\nexit 0\n",
);
fs.chmodSync(path.join(dir, "vendor/bin/phpunit"), 0o755);

writeSteering(dir);
assert.equal(sdd(dir, ["index"]).status, 0);
commitAll(dir, "chore: steering");

git(["checkout", "-b", "announcement-register"], dir);
const issue = path.join(dir, "docs/issues/announcement-register");
fs.mkdirSync(issue, { recursive: true });
fs.writeFileSync(path.join(issue, "proposal.md"), `# お知らせ下書き登録

## Why
- Background: 下書きを登録できない
- Affected: 管理者
- Outcome: 下書きが保存される

## What Changes
- お知らせ下書きを登録する

## Impact
- Type: feat
- Capabilities:
  - New: /specs/announcements/register (new domain: announcements)
- Steering: none
- Decisions: none
- Code: app/Services

## Out of Scope
- 公開予約
`);
fs.writeFileSync(path.join(issue, "requirements.md"), `# Requirements

## Context
- Actors: 管理者
- Current behavior: none
- Assumptions:
  - 認証済み管理者のみ

## Open Questions

# Delta

## Coverage
| capability | spec.md | interfaces.md | data.md | quality.md |
|---|---|---|---|---|
| /specs/announcements/register | changed | no change: no contract | no change: no persisted data | no change: no quality target |

## New domain: /specs/announcements

- title: Announcements
- description: お知らせ機能

## New capability: /specs/announcements/register

- Code: ANN
- title: Register draft
- description: 下書き登録
- tags: [announcements]

## /specs/announcements/register/spec.md

### SECTIONS
#### Purpose
下書きを登録する

#### Scope
- In: 下書き
- Out: 公開

### ADDED
#### REQ-ANN-NEW-1: Save draft
管理者が下書きを保存するとき、システムは下書きを保存しなければならない。

##### Scenario: Save
- **前提** ログイン済み管理者
- **もし** 下書きを保存する
- **ならば** 下書きが保存される
`);
fs.writeFileSync(path.join(issue, "design.md"), `# Design

## Overview
AnnouncementService で下書き保存

## Requirements Traceability
| ID | Components | Test Level |
|---|---|---|
| REQ-ANN-NEW-1 | AnnouncementService | Integration |

## Components and Interfaces
### AnnouncementService
- Location: app/Services/ (new)
- Responsibility: 下書き保存
- Depends on: none
- Provides: saveDraft()

## Data Model
none

## Error Handling
none

## Testing Strategy
| Test Level | Runs on | Notes |
|---|---|---|
| Integration | Local | Feature test |

## Migration
none
`);
fs.writeFileSync(path.join(issue, "task.md"), `# Tasks

- [x] 1. 下書き保存 (P)
  - 1.1 AnnouncementService を追加
    - Requirements: REQ-ANN-NEW-1
  - 1.2 Feature テスト
    - Requirements: REQ-ANN-NEW-1
- [ ] 2. Manual verification
  - Depends on: 1
  - 2.1 画面で下書き保存を確認
    - Requirements: REQ-ANN-NEW-1
  - 2.2 一覧に下書きが表示されることを確認
    - Requirements: REQ-ANN-NEW-1
`);
fs.mkdirSync(path.join(dir, "app/Services"), { recursive: true });
fs.writeFileSync(path.join(dir, "app/Services/AnnouncementService.php"), "<?php\n// REQ-ANN-NEW-1\nclass AnnouncementService {}\n");
fs.mkdirSync(path.join(dir, "tests/Feature"), { recursive: true });
fs.writeFileSync(path.join(dir, "tests/Feature/AnnouncementRegisterTest.php"), "<?php\n// REQ-ANN-NEW-1\nclass AnnouncementRegisterTest {}\n");
commitAll(dir, "docs: announcement register");

step("check setup", () => sdd(dir, ["check", "--scope", "setup"]));
step("check issue (req)", () => sdd(dir, ["check", "--issue", "announcement-register"]));
step("status branch", () => sdd(dir, ["status"]));
const impl = step("check impl", () => sdd(dir, ["check", "--stage", "impl", "--format", "json"]));
const implBody = JSON.parse(impl.stdout);
assert.equal(implBody.ok, true, impl.stdout);
assert.ok(implBody.notes.some((n) => n.rule === "IMPL_HUMAN_PENDING"), "expected human pending note");

fs.writeFileSync(path.join(issue, "task.md"), fs.readFileSync(path.join(issue, "task.md"), "utf8").replace("- [ ] 2. Manual", "- [x] 2. Manual"));
commitAll(dir, "manual ok");

step("check close (pre-apply)", () => sdd(dir, ["check", "--stage", "close", "--issue", "announcement-register"]));
const applied = step("apply", () => sdd(dir, ["apply", "--issue", "announcement-register"]));
assert.equal(applied.status, 0, applied.stdout);
step("check close (post-apply)", () => sdd(dir, ["check", "--stage", "close", "--issue", "announcement-register"]));
fs.rmSync(issue, { recursive: true, force: true });
commitAll(dir, "docs: close issue dir");
step("check close allow-missing", () => sdd(dir, ["check", "--stage", "close", "--allow-missing"]));
step("status re-close", () => sdd(dir, ["status"]));

console.log(JSON.stringify({ fixture: dir, phpAvailable: Boolean(process.env.SDD_PHP_CHECK), steps: log }, null, 2));
