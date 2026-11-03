import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { initRepo, sdd, tempRepo, writeSteering, writeInvoiceIssue, commitAll, git } from "./helpers.mjs";
import {
  validateRequirementsReadability,
  validateDesignReadability,
} from "../src/script/readability.mjs";
import { parseDeltaMarkdown } from "../src/script/delta.mjs";

function summaryHeader(extra = "") {
  return `# Summary

- Clerks change invoices REQ-INV-NEW-1.
Open questions: none

## Role and screen map

| Screen | Clerk |
|---|---|
| Reprint | Show copy REQ-INV-NEW-1 |

${extra}# Context

## Actors

- Clerk: reprints invoices.

## Current behavior

- REQ-INV-NEW-1 reprint.

## Proposal Coverage

- Reprint: REQ-INV-NEW-1

## Assumptions

- none

# Open Questions

# Delta

## Coverage

| capability | spec.md | interfaces.md | data.md | quality.md |
|---|---|---|---|---|
| /specs/billing/invoice | changed | no change: none | no change: none | no change: none |

## /specs/billing/invoice/spec.md

### ADDED

#### REQ-INV-NEW-1: Reprint
When a clerk reprints, the system SHALL issue a copy.

##### Scenario: Reprint
- **Given** an invoice
- **When** the clerk reprints
- **Then** a copy is issued
`;
}

test("readability checks skip requirements without Summary", () => {
  const dir = tempRepo();
  assert.equal(initRepo(dir).status, 0);
  writeSteering(dir);
  git(["checkout", "-b", "invoice-reissue"], dir);
  writeInvoiceIssue(dir);
  commitAll(dir, "docs");
  const out = sdd(dir, ["check", "--issue", "invoice-reissue"]);
  assert.equal(out.status, 0, out.stdout);
});

test("REQ_READABILITY_DRIFT when delta id missing from summary map and coverage", () => {
  const diags = [];
  let body = summaryHeader();
  body = body.replace("- Clerks change invoices REQ-INV-NEW-1.", "- Clerks change invoices.");
  body = body.replace("| Reprint | Show copy REQ-INV-NEW-1 |", "| Reprint | Show copy |");
  body = body.replace("- Reprint: REQ-INV-NEW-1", "- Reprint: design: mechanism");
  const delta = parseDeltaMarkdown(body, "requirements");
  validateRequirementsReadability("/tmp", { docsDir: "docs", lang: "en" }, "x", body, delta, new Set(["REQ-INV-NEW-1"]), diags);
  assert.ok(diags.some((item) => item.rule === "REQ_READABILITY_DRIFT"));
});

test("SUMMARY_OPEN_COUNT and OPEN_QUESTIONS_IN_DETAILS", () => {
  const diags = [];
  let body = summaryHeader();
  body = body.replace("Open questions: none", "Open questions: 2");
  validateRequirementsReadability("/tmp", { docsDir: "docs", lang: "en" }, "x", body, parseDeltaMarkdown(body, "requirements"), new Set(["REQ-INV-NEW-1"]), diags);
  assert.ok(diags.some((item) => item.rule === "SUMMARY_OPEN_COUNT"));

  diags.length = 0;
  body = summaryHeader() + `\n<details>\n\n- [ ] Q9: late?\n\n</details>\n`;
  validateRequirementsReadability("/tmp", { docsDir: "docs", lang: "en" }, "x", body, parseDeltaMarkdown(body, "requirements"), new Set(["REQ-INV-NEW-1"]), diags);
  assert.ok(diags.some((item) => item.rule === "OPEN_QUESTIONS_IN_DETAILS"));
});

test("ROLE_MAP_BARE_CELL and REQ_READABILITY_ID in map", () => {
  const diags = [];
  let body = summaryHeader().replace("| Reprint | Show copy REQ-INV-NEW-1 |", "| Reprint | REQ-INV-NEW-1 |");
  validateRequirementsReadability("/tmp", { docsDir: "docs", lang: "en" }, "x", body, parseDeltaMarkdown(body, "requirements"), new Set(["REQ-INV-NEW-1"]), diags);
  assert.ok(diags.some((item) => item.rule === "ROLE_MAP_BARE_CELL"));

  diags.length = 0;
  body = summaryHeader().replace("- Clerks change invoices REQ-INV-NEW-1.", "- Clerks change invoices REQ-INV-NEW-99.");
  validateRequirementsReadability("/tmp", { docsDir: "docs", lang: "en" }, "x", body, parseDeltaMarkdown(body, "requirements"), new Set(["REQ-INV-NEW-1"]), diags);
  assert.ok(diags.some((item) => item.rule === "REQ_READABILITY_ID"));
});

test("STEERING_GLANCE missing and mismatch on design delta", () => {
  const design = `# Design

## Overview

x

## Requirements Traceability

none

## Components and Interfaces

none

## Data Model

none

## Error Handling

none

## Testing Strategy

none

## Migration

none

# Delta

## /steering/tech.md

### SECTIONS

#### Stack

- Node
`;
  const diags = [];
  validateDesignReadability({ design }, parseDeltaMarkdown(design, "design"), { docsDir: "docs" }, "feat", diags);
  assert.ok(diags.some((item) => item.rule === "STEERING_GLANCE_MISSING"));

  diags.length = 0;
  const withGlance = design.replace(
    "# Delta",
    `## Steering changes at a glance

- /steering/product.md: wrong file

# Delta`,
  );
  validateDesignReadability({ design: withGlance }, parseDeltaMarkdown(withGlance, "design"), { docsDir: "docs" }, "feat", diags);
  assert.ok(diags.some((item) => item.rule === "STEERING_GLANCE"));
});

test("check reports REQ_READABILITY_DRIFT on a real issue shape", () => {
  const dir = tempRepo();
  assert.equal(initRepo(dir).status, 0);
  writeSteering(dir);
  git(["checkout", "-b", "invoice-reissue"], dir);
  writeInvoiceIssue(dir);
  commitAll(dir, "docs: invoice base");
  assert.equal(sdd(dir, ["apply", "--issue", "invoice-reissue"]).status, 0);
  git(["checkout", "-b", "readability-drift"], dir);
  const issue = path.join(dir, "docs/issues/readability-drift");
  fs.mkdirSync(issue, { recursive: true });
  fs.writeFileSync(path.join(issue, "proposal.md"), `# Drift test

## Why
x

## What Changes
- Reprint

## Impact
- Type: feat
- Capabilities:
  - Changed: /specs/billing/invoice
- Steering: none
- Decisions: none
- Code: src

## Out of Scope
n
`);
  let body = summaryHeader();
  body = body.replace("- Clerks change invoices REQ-INV-NEW-1.", "- Clerks change invoices.");
  body = body.replace("| Reprint | Show copy REQ-INV-NEW-1 |", "| Reprint | Show copy |");
  body = body.replace("- Reprint: REQ-INV-NEW-1", "- Reprint: design: mechanism");
  fs.writeFileSync(path.join(issue, "requirements.md"), body);
  commitAll(dir, "docs");
  assert.match(sdd(dir, ["check", "--issue", "readability-drift"]).stdout, /REQ_READABILITY_DRIFT/);
});

function prepareInvoiceWithReprint(dir) {
  assert.equal(initRepo(dir).status, 0);
  writeSteering(dir);
  assert.equal(sdd(dir, ["index"]).status, 0);
  commitAll(dir, "chore: skeleton");
  writeInvoiceIssue(dir);
  const invoice = path.join(dir, "docs/issues/invoice-reissue/requirements.md");
  fs.appendFileSync(
    invoice,
    `
#### REQ-INV-NEW-2: Reprint invoice
When a clerk reprints an invoice, the system SHALL issue a copy.

##### Scenario: Reprint
- **Given** an issued invoice
- **When** the clerk reprints it
- **Then** a copy is issued
`,
  );
  const design = path.join(dir, "docs/issues/invoice-reissue/design.md");
  const designText = fs.readFileSync(design, "utf8");
  fs.writeFileSync(
    design,
    designText.replace(
      "| REQ-INV-NEW-1 | InvoiceService | Integration |",
      "| REQ-INV-NEW-1 | InvoiceService | Integration |\n| REQ-INV-NEW-2 | InvoiceService | Integration |",
    ),
  );
  const task = path.join(dir, "docs/issues/invoice-reissue/task.md");
  fs.writeFileSync(
    task,
    fs.readFileSync(task, "utf8").replaceAll("Requirements: REQ-INV-NEW-1", "Requirements: REQ-INV-NEW-1, REQ-INV-NEW-2"),
  );
  commitAll(dir, "docs: invoice issue");
  const applied = sdd(dir, ["apply", "--issue", "invoice-reissue"]);
  assert.equal(applied.status, 0, applied.stdout + applied.stderr);
}

test("Summary and role map stay in the issue file only", () => {
  const dir = tempRepo();
  prepareInvoiceWithReprint(dir);
  git(["checkout", "-b", "credit-note"], dir);
  const issue = path.join(dir, "docs/issues/credit-note");
  fs.mkdirSync(issue, { recursive: true });
  const config = JSON.parse(fs.readFileSync(path.join(dir, "sdd.config.json"), "utf8"));
  const skill = (name, file) => fs.readFileSync(path.join(dir, config.skillsDir[0], "skills", name, file), "utf8");
  fs.writeFileSync(path.join(issue, "proposal.md"), `# Credit notes

## Why
x

## What Changes
- Credit notes

## Impact
- Type: feat
- Capabilities:
  - New: /specs/returns/credit-note (new domain: returns)
  - Changed: /specs/billing/invoice
- Steering: /steering/messaging.md (new)
- Decisions: none
- Code: src/returns

## Out of Scope
n
`);
  fs.writeFileSync(path.join(issue, "requirements.md"), skill("sdd-req", "example.md"));
  fs.writeFileSync(path.join(issue, "research.md"), skill("sdd-design", "example-research.md"));
  fs.writeFileSync(path.join(issue, "design.md"), skill("sdd-design", "example-design.md"));
  const task = /```markdown\n([\s\S]*?)\n```/.exec(fs.readFileSync(path.join(dir, config.skillsDir[0], "skills/sdd-task/SKILL.md"), "utf8"))[1];
  fs.writeFileSync(path.join(issue, "task.md"), `${task}\n`);
  commitAll(dir, "docs");
  const stamped = sdd(dir, ["stamp", "--issue", "credit-note"]);
  assert.equal(stamped.status, 0, stamped.stdout + stamped.stderr);
  const checked = sdd(dir, ["check", "--issue", "credit-note"]);
  assert.equal(checked.status, 0, checked.stdout + checked.stderr);
  const issueReq = fs.readFileSync(path.join(issue, "requirements.md"), "utf8");
  assert.match(issueReq, /^# Summary/m);
  const invoiceSpec = fs.readFileSync(path.join(dir, "docs/knowledge/specs/billing/invoice/spec.md"), "utf8");
  assert.doesNotMatch(invoiceSpec, /# Summary/);
  assert.doesNotMatch(invoiceSpec, /Role and screen map/);
});
