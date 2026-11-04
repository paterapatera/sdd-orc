import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { countDeltaItems, countIssueFunctionPoints, formatFpForPullRequest, formatFpReport, isCountableId, itemId, pointsForId } from "../src/script/fp.mjs";
import { parseDeltaMarkdown } from "../src/script/delta.mjs";
import { commitAll, git, initRepo, sdd, tempRepo, writeInvoiceIssue, writeSteering, attachReqProcess } from "./helpers.mjs";

test("itemId and pointsForId follow custom NESMA estimated weights", () => {
  assert.equal(itemId("REQ-INV-1: Issue"), "REQ-INV-1");
  assert.equal(isCountableId("REQ-INV-NEW-1"), true);
  assert.equal(isCountableId("REQ-INV-1"), true);
  assert.equal(pointsForId("REQ-INV-NEW-1", "SHALL"), 0);
  assert.equal(pointsForId("REQ-INV-1", "SHALL"), 0);
  assert.equal(pointsForId("DATA-CRN-1", "fields"), 7);
  assert.equal(pointsForId("NFR-PERF-1", "text"), 0);
  assert.equal(pointsForId("IF-X-1", "- Direction: Consumed\n- Uses: IF-Y-1"), 5);
  assert.equal(pointsForId("IF-X-2", "- Direction: Provided\n- Kind: REST API"), 4);
  assert.equal(pointsForId("IF-X-3", "- Kind: REST API"), 0);
});

test("countDeltaItems is stable and covers buckets and kinds", () => {
  const markdown = `# Requirements

# Delta

## /specs/billing/invoice/spec.md

### ADDED
#### REQ-AB-1: One
- Process: Alpha (EQ)
When x, the system SHALL do a.

##### Scenario: S
- **Given** g
- **When** w
- **Then** t

### MODIFIED
#### REQ-BC-1: Changed
- Process: Beta (EQ)
When y, the system SHALL do b.

##### Scenario: S2
- **Given** g
- **When** w
- **Then** t

### REMOVED
#### REQ-CD-1: Gone
legacy

## /specs/billing/invoice/data.md

### ADDED
#### DATA-DE-1: Entity
- Classification: Internal

## /specs/billing/invoice/interfaces.md

### ADDED
#### IF-EF-1: In
- Direction: Consumed
- Uses: IF-Z-1

#### IF-FG-1: Out
- Direction: Provided
- Kind: REST API

## /specs/billing/invoice/quality.md

### ADDED
#### NFR-GH-1: Perf
- Characteristic: Performance efficiency
`;
  const delta = parseDeltaMarkdown(markdown, "requirements");
  const first = countDeltaItems(delta);
  const second = countDeltaItems(delta);
  assert.deepEqual(first, second);
  assert.equal(first.total, 4 + 4 + 7 + 5 + 4);
  assert.equal(first.items.length, 6);
  assert.equal(first.byKind.REQ, 0);
  assert.equal(first.byKind.DATA, 7);
  assert.equal(first.byKind.IF, 9);
  assert.equal(first.byKind.NFR, 0);
  assert.equal(first.summary.total, first.total);
  assert.equal(first.summary.points.EQ, 8);
  assert.equal(first.summary.itemCounts.EQ.ADDED, 2);
  assert.equal(first.summary.itemCounts.EQ.MODIFIED, 0);
  assert.equal(first.summary.itemCounts.NFR.ADDED, 1);
  assert.equal(first.summary.processUnknown.itemCounts.REMOVED, 1);
});

test("provisional NEW ids and duplicate MODIFIED dedupe", () => {
  const markdown = `# Requirements

# Delta

## /specs/billing/invoice/spec.md

### ADDED
#### REQ-INV-NEW-1: One
- Process: One (EQ)
When x, the system SHALL do a.

##### Scenario: S
- **Given** g
- **When** w
- **Then** t

#### DATA-INV-NEW-1: Row
- Classification: Internal

### MODIFIED
#### REQ-INV-1: Twice
- Process: Old one (EQ)
When y, the system SHALL do b.

##### Scenario: S2
- **Given** g
- **When** w
- **Then** t

#### REQ-INV-1: duplicate
- Process: Old one (EQ)
When z, the system SHALL do c.

##### Scenario: S3
- **Given** g
- **When** w
- **Then** t
`;
  const delta = parseDeltaMarkdown(markdown, "requirements");
  const result = countDeltaItems(delta);
  assert.equal(result.total, 4 + 7 + 4);
  assert.equal(result.summary.itemCounts.EQ.ADDED, 2);
  assert.equal(result.items.filter((row) => row.id === "One").length, 1);
  assert.equal(result.items.filter((row) => row.id === "Old one").length, 1);
});

test("REMOVED IF uses Direction from base branch when working tree lost it", () => {
  const readGitAtBase = (rel) => {
    if (rel === "docs/knowledge/specs/billing/invoice/interfaces.md") {
      return `---
---
### IF-LEG-1: Legacy API
- Direction: Provided
- Kind: REST API
`;
    }
    return null;
  };
  const ctx = { knowledgeMap: new Map(), docsDir: "docs/knowledge", readGitAtBase };
  const markdown = `# Requirements

# Delta

## /specs/billing/invoice/interfaces.md

### REMOVED
#### IF-LEG-1: Retire
- reason: replaced
`;
  const delta = parseDeltaMarkdown(markdown, "requirements");
  const result = countDeltaItems(delta, { ...ctx, delta });
  assert.equal(result.total, 4);
  assert.equal(result.summary.points.IF_PROVIDED, 4);
  assert.equal(result.summary.itemCounts.IF_PROVIDED.REMOVED, 1);
});

test("MODIFIED IF without Direction in delta stays unset (no base lookup)", () => {
  const readGitAtBase = () => `### IF-XX-1: X\n- Direction: Provided\n- Kind: REST API\n`;
  const markdown = `# Requirements

# Delta

## /specs/billing/invoice/interfaces.md

### MODIFIED
#### IF-XX-1: Change
- change: wording
`;
  const result = countDeltaItems(parseDeltaMarkdown(markdown, "requirements"), {
    knowledgeMap: new Map(),
    docsDir: "docs/knowledge",
    readGitAtBase,
    delta: parseDeltaMarkdown(markdown, "requirements"),
  });
  assert.equal(result.total, 0);
  assert.equal(result.summary.ifUnset.itemCounts.MODIFIED, 1);
});

test("same id in MODIFIED and REMOVED counts once with REMOVED precedence", () => {
  const markdown = `# Requirements

# Delta

## /specs/billing/invoice/spec.md

### MODIFIED
#### REQ-INV-1: Change
- Process: Invoice (EQ)
When x, the system SHALL x.

##### Scenario: S
- **Given** g
- **When** w
- **Then** t

### REMOVED
#### REQ-INV-1: Drop
- reason: gone
`;
  const result = countDeltaItems(parseDeltaMarkdown(markdown, "requirements"));
  assert.equal(result.total, 4);
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].bucket, "REMOVED");
});

test("IF unset is visible when Direction is missing", () => {
  const markdown = `# Requirements

# Delta

## /specs/billing/invoice/interfaces.md

### ADDED
#### IF-INV-NEW-1: Broken
- Kind: REST API
`;
  const result = countDeltaItems(parseDeltaMarkdown(markdown, "requirements"));
  assert.equal(result.total, 0);
  assert.equal(result.summary.ifUnset.itemCounts.ADDED, 1);
  const text = formatFpReport("x", {
    skipped: false,
    metric: "m",
    laterAddedNote: "",
    summary: result.summary,
    items: result.items,
    total: 0,
  }, "text");
  assert.match(text, /IF unset/);
});

test("realistic multi-file issue total matches hand count", () => {
  const knowledgeMap = new Map([
    ["docs/knowledge/specs/billing/invoice/interfaces.md", `---
---
### IF-OLD-1: Old
- Direction: Consumed
- Uses: IF-EXT-9
`],
  ]);
  const ctx = { knowledgeMap, docsDir: "docs/knowledge" };
  const markdown = `# Requirements

# Delta

## /specs/billing/invoice/spec.md

### ADDED
#### REQ-INV-NEW-1: A
- Process: Confirm order (EQ)
When a, the system SHALL a.

##### Scenario: S1
- **Given** g
- **When** w
- **Then** t

#### REQ-INV-NEW-2: B
- Process: Confirm order (EQ)
When b, the system SHALL b.

##### Scenario: S2
- **Given** g
- **When** w
- **Then** t

#### REQ-INV-NEW-3: C
- Process: Confirm order (EQ)
When c, the system SHALL c.

##### Scenario: S3
- **Given** g
- **When** w
- **Then** t

## /specs/billing/invoice/data.md

### ADDED
#### DATA-INV-NEW-1: D1
- Classification: Internal

#### DATA-INV-NEW-2: D2
- Classification: Internal

## /specs/billing/invoice/interfaces.md

### ADDED
#### IF-INV-NEW-1: Out
- Direction: Provided
- Kind: REST API

#### IF-INV-NEW-2: In
- Direction: Consumed
- Uses: IF-EXT-1

### REMOVED
#### IF-OLD-1: Gone
- reason: obsolete
`;
  const expected = 4 + 2 * 7 + 4 + 5 + 5;
  const result = countDeltaItems(parseDeltaMarkdown(markdown, "requirements"), ctx);
  assert.equal(result.total, expected);
  assert.equal(result.summary.processCount, 1);
  assert.equal(result.summary.reqCount, 3);
});

test("quick issue and missing requirements are not counted", () => {
  const quick = countIssueFunctionPoints({ requirements: "", design: "", task: "# Tasks\n- [ ] 1. x\n" });
  assert.equal(quick.skipped, true);
  assert.equal(quick.reason, "quick_issue");
  assert.equal(quick.total, 0);

  const reverseOnly = countIssueFunctionPoints({ requirements: "# x\n", design: "", task: "" });
  assert.equal(reverseOnly.skipped, false);
  assert.equal(reverseOnly.total, 0);
});

test("fp command on invoice issue matches delta count", () => {
  const dir = tempRepo();
  assert.equal(initRepo(dir).status, 0);
  writeSteering(dir);
  assert.equal(sdd(dir, ["index"]).status, 0);
  commitAll(dir, "chore: skeleton");

  const issue = path.join(dir, "docs/issues/fp-sample");
  fs.mkdirSync(issue, { recursive: true });
  fs.writeFileSync(path.join(issue, "proposal.md"), `# Sample

## Why
- Background: test
- Affected: dev
- Outcome: fp

## What Changes
- count fp

## Impact
- Type: feat
- Capabilities:
  - Changed: /specs/billing/invoice
- Steering: none
- Decisions: none
- Code: src

## Out of Scope
- none
`);
  fs.writeFileSync(path.join(issue, "requirements.md"), `# Requirements

## Context
- Actors: A
- Current behavior: none
- Assumptions:
  - none

## Open Questions

# Delta

## Coverage
| capability | spec.md | interfaces.md | data.md | quality.md |
|---|---|---|---|---|
| /specs/billing/invoice | changed | changed | changed | no change: none |

## /specs/billing/invoice/spec.md

### ADDED
#### REQ-FP-1: Alpha
- Process: Alpha feature (EQ)
When a, the system SHALL alpha.

##### Scenario: A
- **Given** g
- **When** w
- **Then** t

## /specs/billing/invoice/interfaces.md

### ADDED
#### IF-FP-1: Provided API
- Direction: Provided
- Kind: REST API

#### IF-FP-2: Consumed feed
- Direction: Consumed
- Uses: IF-EXT-1

## /specs/billing/invoice/data.md

### ADDED
#### DATA-FP-1: Row
- Classification: Internal
`);
  commitAll(dir, "docs: fp sample");

  const run1 = sdd(dir, ["fp", "--issue", "fp-sample"]);
  const run2 = sdd(dir, ["fp", "--issue", "fp-sample"]);
  assert.equal(run1.status, 0);
  assert.equal(run1.stdout, run2.stdout);
  assert.match(run1.stdout, /total: 20/);
  assert.match(run1.stdout, /Alpha feature\tADDED/);

  const json = JSON.parse(sdd(dir, ["fp", "--issue", "fp-sample", "--format", "json"]).stdout);
  assert.equal(json.total, 20);
  assert.equal(json.skipped, false);
  assert.equal(json.summary.total, 20);
  assert.equal(json.summary.points.EQ, 4);
  assert.equal(json.summary.reqCount, 1);
  assert.equal(json.summary.processCount, 1);
  assert.equal(json.summary.itemCounts.IF_CONSUMED.ADDED, 1);
});

test("formatFpForPullRequest quick and full breakdown", () => {
  const quick = formatFpForPullRequest({ skipped: true, reason: "quick_issue" }, "en");
  assert.match(quick, /Not counted for quick issues/);
  assert.doesNotMatch(quick, /NFR:/);
  const jaQuick = formatFpForPullRequest({ skipped: true, reason: "quick_issue" }, "ja");
  assert.match(jaQuick, /数えません/);
  assert.doesNotMatch(jaQuick, /NFR:/);

  const baseSummary = {
    total: 20,
    points: { DATA: 7, EI: 0, EO: 0, EQ: 4, IF_CONSUMED: 5, IF_PROVIDED: 4 },
    itemCounts: {
      DATA: { ADDED: 1, MODIFIED: 0, REMOVED: 0 },
      EI: { ADDED: 0, MODIFIED: 0, REMOVED: 0 },
      EO: { ADDED: 0, MODIFIED: 0, REMOVED: 0 },
      EQ: { ADDED: 1, MODIFIED: 0, REMOVED: 0 },
      IF_CONSUMED: { ADDED: 1, MODIFIED: 0, REMOVED: 0 },
      IF_PROVIDED: { ADDED: 1, MODIFIED: 0, REMOVED: 0 },
      NFR: { ADDED: 0, MODIFIED: 0, REMOVED: 0 },
    },
    ifUnset: { itemCounts: { ADDED: 0, MODIFIED: 0, REMOVED: 0 }, points: 0 },
    processNone: { itemCounts: { ADDED: 0, MODIFIED: 0, REMOVED: 0 }, points: 0 },
    processUnknown: { itemCounts: { ADDED: 0, MODIFIED: 0, REMOVED: 0 }, points: 0 },
    reqCount: 1,
    processCount: 1,
  };

  const full = formatFpForPullRequest({ skipped: false, summary: baseSummary }, "en");
  assert.match(full, /Total \*\*20\*\* FP/);
  assert.match(full, /IF Consumed \| 5 \| A1\/M0\/R0/);
  assert.doesNotMatch(full, /^NFR:/m);

  const withNfr = formatFpForPullRequest({
    skipped: false,
    summary: {
      ...baseSummary,
      itemCounts: {
        ...baseSummary.itemCounts,
        NFR: { ADDED: 1, MODIFIED: 0, REMOVED: 1 },
      },
    },
  }, "en");
  assert.match(withNfr, /Total \*\*20\*\* FP/);
  assert.match(withNfr, /NFR: A1\/M0\/R1 \(0 FP\)/);

  const jaNfr = formatFpForPullRequest({
    skipped: false,
    summary: {
      ...baseSummary,
      total: 11,
      points: { DATA: 7, EI: 0, EO: 0, EQ: 4, IF_CONSUMED: 0, IF_PROVIDED: 0 },
      itemCounts: {
        DATA: { ADDED: 1, MODIFIED: 0, REMOVED: 0 },
        EI: { ADDED: 0, MODIFIED: 0, REMOVED: 0 },
        EO: { ADDED: 0, MODIFIED: 0, REMOVED: 0 },
        EQ: { ADDED: 1, MODIFIED: 0, REMOVED: 0 },
        IF_CONSUMED: { ADDED: 0, MODIFIED: 0, REMOVED: 0 },
        IF_PROVIDED: { ADDED: 0, MODIFIED: 0, REMOVED: 0 },
        NFR: { ADDED: 2, MODIFIED: 1, REMOVED: 0 },
      },
      processNone: { itemCounts: { ADDED: 0, MODIFIED: 0, REMOVED: 0 }, points: 0 },
      processUnknown: { itemCounts: { ADDED: 0, MODIFIED: 0, REMOVED: 0 }, points: 0 },
      reqCount: 1,
      processCount: 1,
    },
  }, "ja");
  assert.match(jaNfr, /合計 \*\*11\*\* FP/);
  assert.match(jaNfr, /NFR: A2\/M1\/R0（0 FP）/);
});

test("formatFpForPullRequest NFR counts from delta do not change total", () => {
  const markdown = `# Requirements

# Delta

## /specs/billing/invoice/spec.md

### ADDED
#### REQ-INV-NEW-1: One
- Process: One (EQ)
When x, the system SHALL do a.

##### Scenario: S
- **Given** g
- **When** w
- **Then** t

## /specs/billing/invoice/quality.md

### ADDED
#### NFR-INV-NEW-1: Latency
- Characteristic: Performance efficiency
`;
  const { summary, total } = countDeltaItems(parseDeltaMarkdown(markdown, "requirements"));
  assert.equal(total, 4);
  assert.equal(summary.itemCounts.NFR.ADDED, 1);
  const pr = formatFpForPullRequest({ skipped: false, summary }, "en");
  assert.match(pr, /NFR: A1\/M0\/R0 \(0 FP\)/);
  assert.match(pr, /Total \*\*4\*\* FP/);
});

test("formatFpReport skipped text", () => {
  const text = formatFpReport("q", { skipped: true, reason: "quick_issue", metric: "m" }, "text");
  assert.match(text, /skipped: quick_issue/);
});

test("fp after apply still scores REMOVED IF like close ordering", () => {
  const dir = tempRepo();
  assert.equal(initRepo(dir).status, 0);
  writeSteering(dir);
  assert.equal(sdd(dir, ["index"]).status, 0);
  commitAll(dir, "chore: skeleton");
  writeInvoiceIssue(dir);
  const requirements = path.join(dir, "docs/issues/invoice-reissue/requirements.md");
  let text = fs.readFileSync(requirements, "utf8");
  text = text.replace("no change: no contract", "changed");
  fs.writeFileSync(requirements, `${text}
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
`);
  const design = fs.readFileSync(path.join(dir, "docs/issues/invoice-reissue/design.md"), "utf8");
  fs.writeFileSync(
    path.join(dir, "docs/issues/invoice-reissue/design.md"),
    design.replace(
      "| REQ-INV-NEW-1 | InvoiceService | Integration |",
      "| REQ-INV-NEW-1 | InvoiceService | Integration |\n| IF-INV-NEW-1 | InvoiceService | Contract |",
    ),
  );
  const task = fs.readFileSync(path.join(dir, "docs/issues/invoice-reissue/task.md"), "utf8");
  fs.writeFileSync(
    path.join(dir, "docs/issues/invoice-reissue/task.md"),
    task.replace("Requirements: REQ-INV-NEW-1", "Requirements: REQ-INV-NEW-1, IF-INV-NEW-1"),
  );
  commitAll(dir, "docs: add interface");
  assert.equal(sdd(dir, ["apply", "--issue", "invoice-reissue"]).status, 0);
  assert.match(fs.readFileSync(path.join(dir, "docs/knowledge/specs/billing/invoice/interfaces.md"), "utf8"), /IF-INV-1/);
  commitAll(dir, "docs: apply interface on main");
  git(["checkout", "-b", "retire-if"], dir);

  const issue = path.join(dir, "docs/issues/retire-if");
  fs.mkdirSync(issue, { recursive: true });
  fs.writeFileSync(path.join(issue, "proposal.md"), `# Retire invoice API

## Why
- Background: UI replaces API
- Affected: Integrators
- Outcome: API removed

## What Changes
- Remove invoice API interface

## Impact
- Type: feat
- Capabilities:
  - Changed: /specs/billing/invoice
- Steering: none
- Decisions: none
- Code: src/invoice

## Out of Scope
- REQ changes
`);
  fs.writeFileSync(path.join(issue, "requirements.md"), `# Requirements

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
`);
  fs.writeFileSync(path.join(issue, "design.md"), `# Design

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
`);
  fs.writeFileSync(path.join(issue, "task.md"), `# Tasks

- [x] 1. Remove API (P)
  - 1.1 Drop contract
    - Requirements: IF-INV-1
  - 1.2 Remove tests
    - Requirements: IF-INV-1
`);
  commitAll(dir, "docs: retire if proposal");
  assert.equal(sdd(dir, ["stamp", "--issue", "retire-if"]).status, 0);
  assert.equal(sdd(dir, ["check", "--issue", "retire-if"]).status, 0);

  const beforeApply = JSON.parse(sdd(dir, ["fp", "--issue", "retire-if", "--format", "json"]).stdout);
  assert.equal(beforeApply.summary.points.IF_PROVIDED, 4);

  assert.equal(sdd(dir, ["apply", "--issue", "retire-if"]).status, 0);
  const ifacePath = path.join(dir, "docs/knowledge/specs/billing/invoice/interfaces.md");
  if (fs.existsSync(ifacePath)) {
    assert.doesNotMatch(fs.readFileSync(ifacePath, "utf8"), /### IF-INV-1/);
  }

  const afterApply = JSON.parse(sdd(dir, ["fp", "--issue", "retire-if", "--format", "json"]).stdout);
  assert.equal(afterApply.summary.points.IF_PROVIDED, 4);
  assert.equal(afterApply.summary.itemCounts.IF_PROVIDED.REMOVED, 1);
  assert.equal(sdd(dir, ["check", "--stage", "close", "--issue", "retire-if"]).status, 0);
});

test("process types use EI EO EQ weights and Process none is zero", () => {
  const markdown = `# Requirements

# Delta

## /specs/a/spec.md

### ADDED
#### REQ-AB-1: Input
- Process: Register (EI)
When x, the system SHALL save x.

##### Scenario: S
- **Given** g
- **When** w
- **Then** t

#### REQ-AB-2: Output
- Process: Report (EO)
When y, the system SHALL report y.

##### Scenario: S2
- **Given** g
- **When** w
- **Then** t

#### REQ-AB-3: Label only
- Process: none
When z, the system SHALL not show z.

##### Scenario: S3
- **Given** g
- **When** w
- **Then** t
`;
  const result = countDeltaItems(parseDeltaMarkdown(markdown, "requirements"));
  assert.equal(result.total, 4 + 5);
  assert.equal(result.summary.processCount, 2);
  assert.equal(result.summary.processNone.itemCounts.ADDED, 1);
});

test("MODIFIED process when name exists in base branch specs", () => {
  const readGitAtBase = (rel) => {
    if (rel === "docs/knowledge/specs/billing/invoice/spec.md") {
      return `---
---
### REQ-LEG-1: Legacy
- Process: Issue invoice (EO)
When old, the system SHALL old.
`;
    }
    return "";
  };
  const ctx = { knowledgeMap: new Map(), docsDir: "docs/knowledge", readGitAtBase };
  const markdown = `# Requirements

# Delta

## /specs/billing/invoice/spec.md

### ADDED
#### REQ-INV-NEW-1: Wording
- Process: Issue invoice (EO)
When new, the system SHALL new.

##### Scenario: S
- **Given** g
- **When** w
- **Then** t
`;
  const result = countDeltaItems(parseDeltaMarkdown(markdown, "requirements"), ctx);
  assert.equal(result.summary.itemCounts.EO.MODIFIED, 1);
  assert.equal(result.summary.itemCounts.EO.ADDED, 0);
  assert.equal(result.total, 5);
});

test("deterministic fp output for process grouping", () => {
  const markdown = `# Requirements

# Delta

## /specs/x/spec.md

### ADDED
#### REQ-XY-1: a
- Process: Shared (EQ)
When a, the system SHALL a.

##### Scenario: S1
- **Given** g
- **When** w
- **Then** t

#### REQ-XY-2: b
- Process: Shared (EQ)
When b, the system SHALL b.

##### Scenario: S2
- **Given** g
- **When** w
- **Then** t
`;
  const delta = parseDeltaMarkdown(markdown, "requirements");
  assert.deepEqual(countDeltaItems(delta), countDeltaItems(delta));
  assert.equal(countDeltaItems(delta).summary.processCount, 1);
});
