import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { countDeltaItems, countIssueFunctionPoints, formatFpForPullRequest, formatFpReport, isCountableId, itemId, pointsForId } from "../src/script/fp.mjs";
import { parseDeltaMarkdown } from "../src/script/delta.mjs";
import { commitAll, initRepo, sdd, tempRepo, writeSteering } from "./helpers.mjs";

test("itemId and pointsForId follow custom NESMA-simplified weights", () => {
  assert.equal(itemId("REQ-INV-1: Issue"), "REQ-INV-1");
  assert.equal(isCountableId("REQ-INV-NEW-1"), true);
  assert.equal(isCountableId("REQ-INV-1"), true);
  assert.equal(pointsForId("REQ-INV-NEW-1", "SHALL"), 4);
  assert.equal(pointsForId("REQ-INV-1", "SHALL"), 4);
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
When x, the system SHALL do a.

##### Scenario: S
- **Given** g
- **When** w
- **Then** t

### MODIFIED
#### REQ-BC-1: Changed
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
  assert.equal(first.total, 4 + 4 + 4 + 7 + 5 + 4 + 0);
  assert.equal(first.items.length, 7);
  assert.equal(first.byKind.REQ, 12);
  assert.equal(first.byKind.DATA, 7);
  assert.equal(first.byKind.IF, 9);
  assert.equal(first.byKind.NFR, 0);
  assert.equal(first.summary.total, first.total);
  assert.equal(first.summary.points.REQ, 12);
  assert.equal(first.summary.itemCounts.REQ.ADDED, 1);
  assert.equal(first.summary.itemCounts.REQ.MODIFIED, 1);
  assert.equal(first.summary.itemCounts.REQ.REMOVED, 1);
});

test("provisional NEW ids and duplicate MODIFIED dedupe", () => {
  const markdown = `# Requirements

# Delta

## /specs/billing/invoice/spec.md

### ADDED
#### REQ-INV-NEW-1: One
When x, the system SHALL do a.

##### Scenario: S
- **Given** g
- **When** w
- **Then** t

#### DATA-INV-NEW-1: Row
- Classification: Internal

### MODIFIED
#### REQ-INV-1: Twice
When y, the system SHALL do b.

##### Scenario: S2
- **Given** g
- **When** w
- **Then** t

#### REQ-INV-1: duplicate
When z, the system SHALL do c.

##### Scenario: S3
- **Given** g
- **When** w
- **Then** t
`;
  const delta = parseDeltaMarkdown(markdown, "requirements");
  const result = countDeltaItems(delta);
  assert.equal(result.total, 4 + 7 + 4);
  assert.equal(result.summary.itemCounts.REQ.MODIFIED, 1);
  assert.equal(result.items.filter((row) => row.id === "REQ-INV-NEW-1").length, 1);
});

test("REMOVED IF uses Direction from knowledge interfaces.md", () => {
  const knowledgeMap = new Map([
    ["docs/knowledge/specs/billing/invoice/interfaces.md", `---
---
# Interfaces

### IF-LEG-1: Legacy API
- Direction: Provided
- Kind: REST API
`],
  ]);
  const ctx = { knowledgeMap, docsDir: "docs/knowledge" };
  const markdown = `# Requirements

# Delta

## /specs/billing/invoice/interfaces.md

### REMOVED
#### IF-LEG-1: Retire
- reason: replaced
`;
  const delta = parseDeltaMarkdown(markdown, "requirements");
  const result = countDeltaItems(delta, ctx);
  assert.equal(result.total, 4);
  assert.equal(result.summary.points.IF_PROVIDED, 4);
  assert.equal(result.summary.itemCounts.IF_PROVIDED.REMOVED, 1);
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
When a, the system SHALL a.

##### Scenario: S1
- **Given** g
- **When** w
- **Then** t

#### REQ-INV-NEW-2: B
When b, the system SHALL b.

##### Scenario: S2
- **Given** g
- **When** w
- **Then** t

#### REQ-INV-NEW-3: C
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
  const expected = 3 * 4 + 2 * 7 + 4 + 5 + 5;
  assert.equal(countDeltaItems(parseDeltaMarkdown(markdown, "requirements"), ctx).total, expected);
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
  assert.match(run1.stdout, /REQ-FP-1\tADDED/);

  const json = JSON.parse(sdd(dir, ["fp", "--issue", "fp-sample", "--format", "json"]).stdout);
  assert.equal(json.total, 20);
  assert.equal(json.skipped, false);
  assert.equal(json.summary.total, 20);
  assert.equal(json.summary.points.REQ, 4);
  assert.equal(json.summary.itemCounts.IF_CONSUMED.ADDED, 1);
});

test("formatFpForPullRequest quick and full breakdown", () => {
  const quick = formatFpForPullRequest({ skipped: true, reason: "quick_issue" }, "en");
  assert.match(quick, /Not counted for quick issues/);
  const jaQuick = formatFpForPullRequest({ skipped: true, reason: "quick_issue" }, "ja");
  assert.match(jaQuick, /数えません/);

  const full = formatFpForPullRequest({
    skipped: false,
    summary: {
      total: 20,
      points: { DATA: 7, REQ: 4, IF_CONSUMED: 5, IF_PROVIDED: 4 },
      itemCounts: {
        DATA: { ADDED: 1, MODIFIED: 0, REMOVED: 0 },
        REQ: { ADDED: 1, MODIFIED: 0, REMOVED: 0 },
        IF_CONSUMED: { ADDED: 1, MODIFIED: 0, REMOVED: 0 },
        IF_PROVIDED: { ADDED: 1, MODIFIED: 0, REMOVED: 0 },
      },
      ifUnset: { itemCounts: { ADDED: 0, MODIFIED: 0, REMOVED: 0 }, points: 0 },
    },
  }, "en");
  assert.match(full, /Total \*\*20\*\* FP/);
  assert.match(full, /IF Consumed \| 5 \| A1\/M0\/R0/);
});

test("formatFpReport skipped text", () => {
  const text = formatFpReport("q", { skipped: true, reason: "quick_issue", metric: "m" }, "text");
  assert.match(text, /skipped: quick_issue/);
});
