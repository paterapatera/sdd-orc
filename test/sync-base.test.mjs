import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { resolveFetchRemote, runSyncBase } from "../src/script/sync-base.mjs";
import {
  addOrigin,
  bareRemote,
  cloneRepo,
  commitAll,
  git,
  initRepo,
  prepareRepo,
  pushOrigin,
  sdd,
  tempRepo,
  writeInvoiceIssue,
  writeSteering,
} from "./helpers.mjs";

function read(dir, rel) {
  return fs.readFileSync(path.join(dir, rel), "utf8");
}

function rev(dir, ref) {
  return git(["rev-parse", ref], dir).stdout.trim();
}

function remoteMainSha(barePath) {
  return git(["ls-remote", barePath, "refs/heads/main"], process.cwd()).stdout.split("\t")[0].trim();
}

test("sync-base fast-forwards stale main while feature branch stays checked out", () => {
  const bare = bareRemote();
  const hub = tempRepo();
  prepareRepo(hub);
  addOrigin(hub, bare);
  pushOrigin(hub);
  const feature = cloneRepo(bare);
  git(["checkout", "-b", "feature-work"], feature);
  fs.writeFileSync(path.join(feature, "dirty.txt"), "keep-me\n");
  git(["update-ref", "-d", "refs/heads/main"], feature);

  git(["checkout", "main"], hub);
  fs.writeFileSync(path.join(hub, "on-main.txt"), "new\n");
  commitAll(hub, "feat: advance main");
  const pushed = pushOrigin(hub);
  assert.equal(pushed.status, 0, pushed.stderr || pushed.stdout);
  const expectedMain = remoteMainSha(bare);

  const beforeHead = rev(feature, "HEAD");
  const sync = sdd(feature, ["sync-base"]);
  assert.equal(sync.status, 0, sync.stderr + sync.stdout);
  assert.match(sync.stdout, /fast-forwarded main|created local main/);
  assert.equal(rev(feature, "HEAD"), beforeHead);
  assert.equal(git(["branch", "--show-current"], feature).stdout.trim(), "feature-work");
  assert.equal(read(feature, "dirty.txt"), "keep-me\n");
  assert.equal(rev(feature, "main"), expectedMain);
});

test("sync-base creates missing local main", () => {
  const bare = bareRemote();
  const hub = tempRepo();
  prepareRepo(hub);
  addOrigin(hub, bare);
  pushOrigin(hub);
  const clone = cloneRepo(bare);
  git(["checkout", "-b", "feature-only"], clone);
  git(["update-ref", "-d", "refs/heads/main"], clone);
  const sync = sdd(clone, ["sync-base"]);
  assert.equal(sync.status, 0, sync.stderr + sync.stdout);
  assert.match(sync.stdout, /created local main/);
  assert.equal(rev(clone, "main"), rev(hub, "main"));
});

test("sync-base is a no-op when already up to date", () => {
  const bare = bareRemote();
  const hub = tempRepo();
  prepareRepo(hub);
  addOrigin(hub, bare);
  pushOrigin(hub);
  const first = sdd(hub, ["sync-base"]);
  assert.equal(first.status, 0);
  assert.match(first.stdout, /fast-forwarded|created|already up to date/);
  const second = sdd(hub, ["sync-base"]);
  assert.equal(second.status, 0);
  assert.match(second.stdout, /already up to date/);
});

test("sync-base stops when local main is ahead of the remote", () => {
  const bare = bareRemote();
  const hub = tempRepo();
  prepareRepo(hub);
  addOrigin(hub, bare);
  pushOrigin(hub);
  fs.writeFileSync(path.join(hub, "local-only.txt"), "x\n");
  commitAll(hub, "feat: unpushed main");
  git(["checkout", "-b", "feature"], hub);
  const beforeMain = rev(hub, "main");
  const sync = sdd(hub, ["sync-base"]);
  assert.equal(sync.status, 1, sync.stdout);
  assert.match(sync.stderr, /not on origin\/main/);
  assert.equal(rev(hub, "main"), beforeMain);
});

test("sync-base stops when local main diverged from remote", () => {
  const bare = bareRemote();
  const hub = tempRepo();
  prepareRepo(hub);
  addOrigin(hub, bare);
  pushOrigin(hub);
  const clone = cloneRepo(bare);
  fs.writeFileSync(path.join(clone, "remote-side.txt"), "remote\n");
  commitAll(clone, "feat: on remote");
  pushOrigin(clone);
  git(["checkout", "main"], hub);
  fs.writeFileSync(path.join(hub, "local-side.txt"), "local\n");
  commitAll(hub, "feat: local only");
  git(["checkout", "-b", "feature"], hub);
  const beforeMain = rev(hub, "main");
  const sync = sdd(hub, ["sync-base"]);
  assert.equal(sync.status, 1);
  assert.match(sync.stderr, /not on origin\/main/);
  assert.equal(rev(hub, "main"), beforeMain);
});

test("sync-base without remote skips with a note", () => {
  const dir = tempRepo();
  prepareRepo(dir);
  const sync = sdd(dir, ["sync-base"]);
  assert.equal(sync.status, 0);
  assert.match(sync.stdout, /no git remote/);
});

test("sync-base stops when fetch fails", () => {
  const dir = tempRepo();
  prepareRepo(dir);
  git(["remote", "add", "origin", path.join(dir, "missing-bare-remote")], dir);
  const sync = sdd(dir, ["sync-base"]);
  assert.equal(sync.status, 1);
  assert.match(sync.stderr, /fetch failed/);
});

test("sync-base uses upstream remote when configured on main", () => {
  const upstreamBare = bareRemote();
  const originBare = bareRemote();
  const hub = tempRepo();
  prepareRepo(hub);
  git(["remote", "add", "upstream", upstreamBare], hub);
  git(["remote", "add", "origin", originBare], hub);
  const initial = git(["push", "-u", "upstream", "main"], hub);
  assert.equal(initial.status, 0, initial.stderr || initial.stdout);

  const advance = cloneRepo(upstreamBare);
  fs.writeFileSync(path.join(advance, "via-upstream.txt"), "u\n");
  commitAll(advance, "feat: upstream advance");
  const advanced = pushOrigin(advance);
  assert.equal(advanced.status, 0, advanced.stderr || advanced.stdout);
  const expectedMain = remoteMainSha(upstreamBare);

  git(["checkout", "-b", "feature"], hub);
  const staleMain = rev(hub, "main");
  assert.notEqual(staleMain, expectedMain);
  const sync = sdd(hub, ["sync-base"]);
  assert.equal(sync.status, 0, sync.stderr + sync.stdout);
  assert.equal(rev(hub, "main"), expectedMain);
  assert.equal(resolveFetchRemote(hub, "main", (cwd, args) => git(args, cwd)), "upstream");
});

test("after sync-base renumber avoids id collision with merged main", () => {
  const bare = bareRemote();
  const mainRepo = tempRepo();
  prepareRepo(mainRepo);
  writeInvoiceIssue(mainRepo);
  commitAll(mainRepo, "docs: proposal");
  assert.equal(sdd(mainRepo, ["apply", "--issue", "invoice-reissue"]).status, 0);
  commitAll(mainRepo, "docs: invoice on main");
  addOrigin(mainRepo, bare);
  pushOrigin(mainRepo);

  const spec = path.join(mainRepo, "docs/knowledge/specs/billing/invoice/spec.md");
  const baseSpec = read(mainRepo, "docs/knowledge/specs/billing/invoice/spec.md");
  const mainBlock = "### REQ-INV-2: Main copy\nWhen the system archives an invoice, the system SHALL archive it.\n\n#### Scenario: Archive\n- **Given** an invoice\n- **When** the archive job runs\n- **Then** the invoice is archived\n";
  fs.writeFileSync(spec, `${baseSpec.trim()}\n\n${mainBlock}`);
  commitAll(mainRepo, "feat: main copy on origin");
  pushOrigin(mainRepo);

  const featureRepo = cloneRepo(bare);
  git(["checkout", "-b", "other-invoice"], featureRepo);
  const featureBlock = "### REQ-INV-2: Feature copy\nWhen a clerk reprints an invoice, the system SHALL reprint it.\n\n#### Scenario: Reprint\n- **Given** an invoice\n- **When** the clerk reprints it\n- **Then** a copy is issued\n";
  fs.writeFileSync(path.join(featureRepo, "docs/knowledge/specs/billing/invoice/spec.md"), `${baseSpec.trim()}\n\n${featureBlock}`);
  fs.writeFileSync(path.join(featureRepo, "src/extra.js"), "// added REQ-INV-2\n");
  commitAll(featureRepo, "feat: feature copy");

  git(["update-ref", "-d", "refs/heads/main"], featureRepo);
  const staleRenumber = sdd(featureRepo, ["renumber", "--base", "main"]);
  assert.equal(staleRenumber.status, 2);

  const sync = sdd(featureRepo, ["sync-base"]);
  assert.equal(sync.status, 0, sync.stderr + sync.stdout);
  const featureSpec = path.join(featureRepo, "docs/knowledge/specs/billing/invoice/spec.md");
  fs.writeFileSync(featureSpec, `${read(featureRepo, "docs/knowledge/specs/billing/invoice/spec.md").trim()}\n\n${mainBlock}`);
  const numbered = sdd(featureRepo, ["renumber", "--base", "main"]);
  assert.equal(numbered.status, 0, numbered.stdout + numbered.stderr);
  const after = read(featureRepo, "docs/knowledge/specs/billing/invoice/spec.md");
  assert.match(after, /### REQ-INV-2: Main copy/);
  assert.match(after, /### REQ-INV-3: Feature copy/);
});

test("after sync-base fp scores REMOVED IF when local main was missing", () => {
  const bare = bareRemote();
  const dir = tempRepo();
  prepareRepo(dir);
  writeInvoiceIssue(dir);
  let requirements = read(dir, "docs/issues/invoice-reissue/requirements.md");
  requirements = requirements.replace("no change: no contract", "changed");
  fs.writeFileSync(
    path.join(dir, "docs/issues/invoice-reissue/requirements.md"),
    `${requirements}
## /specs/billing/invoice/interfaces.md

### METADATA
- title: Invoice API
- description: Contract
- tags: [billing]

### SECTIONS
#### Purpose
Invoice API.

### ADDED
#### IF-INV-NEW-1: Issue invoice API
- Kind: REST API
- Direction: Provided
- Counterpart: External: Billing
- Compatibility: compatible

The system SHALL expose invoice issue.
`,
  );
  const design = read(dir, "docs/issues/invoice-reissue/design.md");
  fs.writeFileSync(
    path.join(dir, "docs/issues/invoice-reissue/design.md"),
    design.replace(
      "| REQ-INV-NEW-1 | InvoiceService | Integration |",
      "| REQ-INV-NEW-1 | InvoiceService | Integration |\n| IF-INV-NEW-1 | InvoiceService | Contract |",
    ),
  );
  const task = read(dir, "docs/issues/invoice-reissue/task.md");
  fs.writeFileSync(
    path.join(dir, "docs/issues/invoice-reissue/task.md"),
    task.replace("Requirements: REQ-INV-NEW-1", "Requirements: REQ-INV-NEW-1, IF-INV-NEW-1"),
  );
  commitAll(dir, "docs: add interface");
  assert.equal(sdd(dir, ["apply", "--issue", "invoice-reissue"]).status, 0);
  commitAll(dir, "docs: apply interface on main");
  addOrigin(dir, bare);
  pushOrigin(dir);

  git(["checkout", "-b", "retire-if"], dir);
  const issue = path.join(dir, "docs/issues/retire-if");
  fs.mkdirSync(issue, { recursive: true });
  fs.writeFileSync(path.join(issue, "proposal.md"), read(dir, "docs/issues/invoice-reissue/proposal.md"));
  fs.writeFileSync(
    path.join(issue, "requirements.md"),
    `# Requirements

## Context
- Actors: Integrator
- Current behavior: IF-INV-1
- Assumptions:
  - UI only

## Open Questions

# Delta

## Coverage
| capability | spec.md | interfaces.md | data.md | quality.md |
|---|---|---|---|---|
| /specs/billing/invoice | no change: UI only | changed | no change: no persisted data | no change: no quality target |

## /specs/billing/invoice/interfaces.md

### REMOVED
#### IF-INV-1: Retire API
- reason: replaced by UI
`,
  );
  fs.writeFileSync(
    path.join(issue, "design.md"),
    `# Design

## Overview
Remove API contract.

## Requirements Traceability
| ID | Components | Test Level |
|---|---|---|
| IF-INV-1 | InvoiceService | Contract |

## Components and Interfaces
### InvoiceService
- Location: src/invoice/ (modified)
- Responsibility: Invoice
- Depends on: none
- Provides: none

## Data Model
none

## Error Handling
none

## Testing Strategy
| Test Level | Runs on | Notes |
|---|---|---|
| Contract | Local | API removal |

## Migration
none
`,
  );
  fs.writeFileSync(
    path.join(issue, "task.md"),
    `# Tasks

- [x] 1. Remove API (P)
  - 1.1 Drop contract
    - Requirements: IF-INV-1
  - 1.2 Remove tests
    - Requirements: IF-INV-1
`,
  );
  commitAll(dir, "docs: retire if proposal");
  assert.equal(sdd(dir, ["stamp", "--issue", "retire-if"]).status, 0);
  assert.equal(sdd(dir, ["check", "--issue", "retire-if"]).status, 0);
  assert.equal(sdd(dir, ["apply", "--issue", "retire-if"]).status, 0);

  git(["update-ref", "-d", "refs/heads/main"], dir);
  const beforeSync = JSON.parse(sdd(dir, ["fp", "--issue", "retire-if", "--format", "json"]).stdout);
  assert.equal(beforeSync.summary.itemCounts.IF_PROVIDED.REMOVED, 0);
  assert.equal(beforeSync.summary.points.IF_PROVIDED, 0);

  assert.equal(sdd(dir, ["sync-base"]).status, 0);
  const afterSync = JSON.parse(sdd(dir, ["fp", "--issue", "retire-if", "--format", "json"]).stdout);
  assert.equal(afterSync.summary.itemCounts.IF_PROVIDED.REMOVED, 1);
  assert.equal(afterSync.summary.points.IF_PROVIDED, 4);
});

test("runSyncBase module rejects update when local is ahead", () => {
  const dir = tempRepo();
  prepareRepo(dir);
  const bare = bareRemote();
  addOrigin(dir, bare);
  pushOrigin(dir);
  fs.writeFileSync(path.join(dir, "ahead.txt"), "a\n");
  commitAll(dir, "local ahead");
  const result = runSyncBase(dir, "main", (cwd, args) => git(args, cwd));
  assert.equal(result.code, 1);
  assert.match(result.stderr, /commit\(s\) not on/);
});
