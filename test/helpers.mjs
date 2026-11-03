import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assembleOverview, extractBlock, MARKER_AGENT_BEGIN, MARKER_AGENT_END, MARKER_GENERATED_BEGIN, MARKER_GENERATED_END } from "../src/script/overview.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const cliPath = path.join(repoRoot, "src/cli.mjs");

const gitEnv = {
  ...process.env,
  GIT_AUTHOR_NAME: "test",
  GIT_AUTHOR_EMAIL: "test@example.com",
  GIT_COMMITTER_NAME: "test",
  GIT_COMMITTER_EMAIL: "test@example.com",
};

export function run(args, cwd) {
  const result = spawnSync(process.execPath, args, { cwd, encoding: "utf8", env: gitEnv });
  return { status: result.status ?? 1, stdout: result.stdout || "", stderr: result.stderr || "" };
}

export function git(args, cwd) {
  return spawnSync("git", args, { cwd, encoding: "utf8", env: gitEnv });
}

export function tempRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sdd-orc-"));
  const created = git(["init", "-b", "main"], dir);
  if (created.status !== 0) throw new Error(created.stderr);
  return dir;
}

export function initRepo(dir, args = []) {
  return run([cliPath, "init", ...args], dir);
}

export function sdd(dir, args) {
  const config = JSON.parse(fs.readFileSync(path.join(dir, "sdd.config.json"), "utf8"));
  return run([path.join(dir, config.skillsDir[0], "skills/sdd-scripts/sdd.mjs"), ...args], dir);
}

const STEERING = {
  "product.md": ["Purpose", "Stakeholders and Users", "Capabilities Overview", "External Systems", "Operational Scenarios", "Constraints", "Related"],
  "glossary.md": ["Terms", "Related"],
  "architecture.md": ["Overview", "Quality Priorities", "Context View", "Component View", "Runtime View", "Deployment View", "Cross-cutting Concerns", "Related"],
  "tech.md": ["Stack", "Development Environment", "Common Commands", "Coding Conventions", "Testing Approach", "Related"],
  "structure.md": ["Repository Layout", "Module Boundaries", "Naming Conventions", "Dependency Rules", "Code-to-Specs Mapping", "Related"],
};

export function writeSteering(dir, docsDir = "docs") {
  const base = path.join(dir, docsDir, "knowledge", "steering");
  fs.mkdirSync(base, { recursive: true });
  for (const [filename, headings] of Object.entries(STEERING)) {
    const title = filename.replace(".md", "");
    const body = headings.map((heading) => `## ${heading}\n\n${heading} for the product.\n`).join("\n");
    fs.writeFileSync(path.join(base, filename), `---\ntype: Steering\ntitle: ${title}\ndescription: ${title} steering\ntags: [product]\n---\n# ${title}\n\n${body}`);
  }
}

export function commitAll(dir, message) {
  git(["add", "."], dir);
  return git(["commit", "-m", message], dir);
}

export function writeInvoiceIssue(dir, docsDir = "docs") {
  const issue = path.join(dir, docsDir, "issues/invoice-reissue");
  fs.mkdirSync(issue, { recursive: true });
  fs.writeFileSync(path.join(issue, "proposal.md"), `# Issue an invoice

## Why
- Background: Orders have no invoice.
- Affected: Customers
- Outcome: An invoice exists after confirmation.

## What Changes
- The system issues an invoice when an order is confirmed.

## Impact
- Type: feat
- Capabilities:
  - New: /specs/billing/invoice (new domain: billing)
- Steering: none
- Decisions: none
- Code: src/invoice

## Out of Scope
- Payments
`);
  fs.writeFileSync(path.join(issue, "requirements.md"), `# Requirements

## Context
- Actors: Customer
- Current behavior: none
- Assumptions:
  - Orders can be confirmed.

## Open Questions

# Delta

## Coverage
| capability | spec.md | interfaces.md | data.md | quality.md |
|---|---|---|---|---|
| /specs/billing/invoice | changed | no change: no contract | no change: no persisted data | no change: no quality target |

## New domain: /specs/billing

- title: Billing
- description: Bills confirmed orders.

## New capability: /specs/billing/invoice

- Code: INV
- title: Invoice
- description: Issues invoices for confirmed orders.
- tags: [billing]

## /specs/billing/invoice/spec.md

### SECTIONS
#### Purpose
The invoice capability records invoices.

#### Scope
- In: confirmed orders
- Out: payments

### ADDED
#### REQ-INV-NEW-1: Issue invoice on confirmation
When an order is confirmed, the system SHALL issue an invoice.

##### Scenario: Issue on confirmation
- **Given** a confirmed order
- **When** the confirmation is recorded
- **Then** an invoice is issued
`);
  fs.writeFileSync(path.join(issue, "design.md"), `# Design

## Overview
Issue an invoice when an order is confirmed.

## Requirements Traceability
| ID | Components | Test Level |
|---|---|---|
| REQ-INV-NEW-1 | InvoiceService | Integration |

## Components and Interfaces
### InvoiceService
- Location: src/invoice/ (new)
- Responsibility: Issue invoices.
- Depends on: none
- Provides: issue(orderId)

## Data Model
none

## Error Handling
none

## Testing Strategy
| Test Level | Runs on | Notes |
|---|---|---|
| Integration | Local | Invoice service |

## Migration
none
`);
  fs.writeFileSync(path.join(issue, "task.md"), `# Tasks

- [x] 1. Issue invoice (P)
  - 1.1 Create the invoice service
    - Requirements: REQ-INV-NEW-1
  - 1.2 Integration test for confirmation
    - Requirements: REQ-INV-NEW-1
`);
  fs.mkdirSync(path.join(dir, "src"), { recursive: true });
  fs.writeFileSync(path.join(dir, "src/invoice.js"), "// covers REQ-INV-NEW-1\nexport const ready = true;\n");
  refreshIssueOverview(dir, "invoice-reissue", invoiceOverviewAgent(false));
}

const INVOICE_OVERVIEW_AGENT_REPRINT = invoiceOverviewAgent(true);

function invoiceOverviewAgent(includeReprint) {
  const bullets = includeReprint
    ? `      <li data-sdd-ids="REQ-INV-NEW-1,REQ-INV-NEW-2">REQ-INV-NEW-1 on confirmation; REQ-INV-NEW-2 for clerk reprints.</li>
      <li data-sdd-ids="REQ-INV-NEW-1">Integration coverage targets invoice issue flow.</li>
      <li data-sdd-ids="REQ-INV-NEW-2">Reprint leaves one logical invoice with a copy.</li>`
    : `      <li data-sdd-ids="REQ-INV-NEW-1">REQ-INV-NEW-1 issues an invoice when an order is confirmed.</li>
      <li data-sdd-ids="REQ-INV-NEW-1">One obligation per requirement with an integration scenario.</li>
      <li data-sdd-ids="REQ-INV-NEW-1">Billing capability adds invoice records only.</li>`;
  const tableIds = includeReprint ? "REQ-INV-NEW-1,REQ-INV-NEW-2" : "REQ-INV-NEW-1";
  return `${MARKER_AGENT_BEGIN}
<section data-sdd-part="agent" data-sdd-undecided-count="0">
  <div data-sdd-summary>
    <ul data-sdd-bullets>
${bullets}
    </ul>
  </div>
  <div data-sdd-table="1" data-sdd-table-kind="permissions">
    <table>
      <tr><th>Role</th><th>Invoice data</th></tr>
      <tr><th>Customer</th><td data-sdd-cell="decided" data-sdd-ids="${tableIds}">view issued invoice</td></tr>
      <tr><th>System</th><td data-sdd-cell="decided" data-sdd-ids="REQ-INV-NEW-1">create on confirmation</td></tr>
    </table>
  </div>
</section>
${MARKER_AGENT_END}
`;
}

/** Run \`sdd overview\` and optionally replace the agent block (markers included). */
export function refreshIssueOverview(dir, issue, agentBlock = null) {
  const run = sdd(dir, ["overview", "--issue", issue]);
  if (run.status !== 0) throw new Error(run.stdout + run.stderr);
  if (!agentBlock) return;
  const config = JSON.parse(fs.readFileSync(path.join(dir, "sdd.config.json"), "utf8"));
  const overviewPath = path.join(dir, config.docsDir, "issues", issue, "overview.html");
  const html = fs.readFileSync(overviewPath, "utf8");
  const generated = extractBlock(html, MARKER_GENERATED_BEGIN, MARKER_GENERATED_END);
  const agent = agentBlock.includes(MARKER_AGENT_BEGIN) ? agentBlock : `${MARKER_AGENT_BEGIN}\n${agentBlock}\n${MARKER_AGENT_END}\n`;
  fs.writeFileSync(overviewPath, assembleOverview(generated, agent));
}

export function refreshInvoiceReprintOverview(dir) {
  refreshIssueOverview(dir, "invoice-reissue", INVOICE_OVERVIEW_AGENT_REPRINT);
}

export const DOCS_ONLY_OVERVIEW_AGENT = `${MARKER_AGENT_BEGIN}
<section data-sdd-part="agent" data-sdd-undecided-count="0">
  <div data-sdd-summary>
    <ul data-sdd-bullets>
      <li data-sdd-ids="">Decision-only change with no requirement ids in the delta.</li>
      <li data-sdd-ids="">Steering and ADR updates are described in design and research.</li>
      <li data-sdd-ids="">Apply still requires overview.html for check and apply gates.</li>
    </ul>
  </div>
  <div data-sdd-table="1" data-sdd-table-kind="none">
    <table>
      <tr><th>Axis</th><th>Notes</th></tr>
      <tr><th>Requirements ids</th><td data-sdd-cell="none" data-sdd-reason="Coverage none; no spec requirement delta">none</td></tr>
    </table>
  </div>
</section>
${MARKER_AGENT_END}
`;
