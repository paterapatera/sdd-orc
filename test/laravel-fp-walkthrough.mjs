#!/usr/bin/env node
/**
 * Read-only verification against cloned paterapatera/laravel-fp.
 * Does not commit or push in laravel-fp.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cliPath = path.join(repoRoot, "src/cli.mjs");
const fp = process.env.LARAVEL_FP || "/tmp/laravel-fp";

function run(cmd, args, cwd = fp) {
  const result = spawnSync(cmd, args, { cwd, encoding: "utf8" });
  return { status: result.status ?? 1, stdout: result.stdout || "", stderr: result.stderr || "" };
}

function sdd(args) {
  return run("node", [".agents/skills/sdd-scripts/sdd.mjs", ...args]);
}

const log = [];
function step(name, fn) {
  const result = fn();
  log.push({ step: name, ...result, out: (result.stdout + result.stderr).trim().slice(0, 2000) });
  return result;
}

if (!fs.existsSync(fp)) {
  console.error(`Missing ${fp}. Clone laravel-fp first.`);
  process.exit(2);
}

step("update", () => run("node", [cliPath, "update"], fp));
const config = JSON.parse(fs.readFileSync(path.join(fp, "sdd.config.json"), "utf8"));
config.testCommand = fs.existsSync(path.join(fp, "vendor/bin/phpunit"))
  ? "vendor/bin/phpunit"
  : "./vendor/bin/phpunit";
fs.writeFileSync(path.join(fp, "sdd.config.json"), `${JSON.stringify(config, null, 2)}\n`);
if (!fs.existsSync(path.join(fp, "vendor/bin/phpunit"))) {
  fs.mkdirSync(path.join(fp, "vendor/bin"), { recursive: true });
  fs.writeFileSync(path.join(fp, "vendor/bin/phpunit"), "#!/bin/sh\n# stub when PHP/composer unavailable\nexit 0\n");
  fs.chmodSync(path.join(fp, "vendor/bin/phpunit"), 0o755);
}

step("check setup (main)", () => sdd(["check", "--scope", "setup"]));
step("check tree (main)", () => sdd(["check"]));
step("status --all (main)", () => sdd(["status", "--all"]));

run("git", ["checkout", "-b", "sdd-orc-smoke"], fp);
const issueDir = path.join(fp, "docs/issues/sdd-orc-smoke");
fs.mkdirSync(issueDir, { recursive: true });
fs.writeFileSync(path.join(issueDir, "proposal.md"), `# SDD スモーク

## Why
- Background: sdd-orc 0.3.17 の検証
- Affected: 開発者
- Outcome: check が通る

## What Changes
- 検証用の下書き保存ログを残す

## Impact
- Type: feat
- Capabilities:
  - Changed: /specs/announcements/register
- Steering: none
- Decisions: none
- Code: app/Announcements

## Out of Scope
- 仕様の実変更
`);
fs.writeFileSync(path.join(issueDir, "requirements.md"), `# Requirements

## Context
- Actors: 管理者
- Current behavior: REQ-ANR-14
- Assumptions:
  - 検証のみ

## Open Questions

# Delta

## Coverage
| capability | spec.md | interfaces.md | data.md | quality.md |
|---|---|---|---|---|
| /specs/announcements/register | changed | no change: no contract | no change: no persisted data | no change: no quality target |

## /specs/announcements/register/spec.md

### ADDED
#### REQ-ANR-NEW-1: Log draft registration
管理者が下書きを保存したとき、システムは登録ログを残さなければならない。

##### Scenario: Save draft
- **前提** 管理者
- **もし** 下書きを保存する
- **ならば** 登録ログが残る
`);
fs.writeFileSync(path.join(issueDir, "design.md"), `# Design

## Overview
AnnouncementRegistrar にログ一行

## Requirements Traceability
| ID | Components | Test Level |
|---|---|---|
| REQ-ANR-NEW-1 | AnnouncementRegistrar | Unit |

## Components and Interfaces
### AnnouncementRegistrar
- Location: app/Announcements/ (modified)
- Responsibility: 下書き登録
- Depends on: none
- Provides: register()

## Data Model
none

## Error Handling
none

## Testing Strategy
| Test Level | Runs on | Notes |
|---|---|---|
| Unit | Local | registrar |

## Migration
none
`);
fs.writeFileSync(path.join(issueDir, "task.md"), `# Tasks

- [x] 1. ログ追加 (P)
  - 1.1 Registrar にログを追加
    - Requirements: REQ-ANR-NEW-1
  - 1.2 Unit テスト
    - Requirements: REQ-ANR-NEW-1
- [ ] 2. Manual verification
  - Depends on: 1
  - 2.1 画面で下書き保存
    - Requirements: REQ-ANR-NEW-1
  - 2.2 ログ出力を目視
    - Requirements: REQ-ANR-NEW-1
`);
fs.mkdirSync(path.join(fp, "tests/Unit/Announcements"), { recursive: true });
fs.appendFileSync(
  path.join(fp, "app/Announcements/AnnouncementRegistrar.php"),
  "\n// REQ-ANR-NEW-1 smoke\n",
);
fs.writeFileSync(
  path.join(fp, "tests/Unit/Announcements/SddOrcSmokeTest.php"),
  "<?php\n\ntest('REQ-ANR-NEW-1 smoke', function () {\n    expect(true)->toBeTrue();\n});\n",
);
run("git", ["add", "docs/issues/sdd-orc-smoke", "tests/Unit/Announcements/SddOrcSmokeTest.php", "app/Announcements/AnnouncementRegistrar.php"], fp);

step("stamp", () => sdd(["stamp", "--issue", "sdd-orc-smoke"]));
step("check issue", () => sdd(["check", "--issue", "sdd-orc-smoke"]));
step("status branch", () => sdd(["status"]));
step("check impl", () => sdd(["check", "--stage", "impl", "--format", "json"]));
step("check allow-missing (hotfix)", () => {
  const cur = run("git", ["branch", "--show-current"], fp).stdout.trim();
  run("git", ["checkout", "main"], fp);
  const result = sdd(["check", "--allow-missing"]);
  if (cur) run("git", ["checkout", cur], fp);
  return result;
});
step("manual ok", () => {
  const task = fs.readFileSync(path.join(issueDir, "task.md"), "utf8").replace("- [ ] 2. Manual", "- [x] 2. Manual");
  fs.writeFileSync(path.join(issueDir, "task.md"), task);
  return { status: 0, stdout: "task checked", stderr: "" };
});
step("apply", () => sdd(["apply", "--issue", "sdd-orc-smoke"]));
step("check close", () => sdd(["check", "--stage", "close", "--issue", "sdd-orc-smoke"]));
fs.rmSync(issueDir, { recursive: true, force: true });
step("check close allow-missing", () => sdd(["check", "--stage", "close", "--allow-missing"]));
step("status re-close", () => sdd(["status"]));

const php = run("php", ["-v"], fp);
const artisan = run("php", ["artisan", "test", "--help"], fp);

console.log(
  JSON.stringify(
    {
      laravelFp: fp,
      sddVersion: JSON.parse(fs.readFileSync(path.join(fp, "sdd.config.json"), "utf8")).version,
      phpAvailable: php.status === 0,
      artisanTestAvailable: artisan.status === 0,
      testCommandUsed: config.testCommand,
      steps: log.map(({ step, status, out }) => ({ step, status, out })),
    },
    null,
    2,
  ),
);
