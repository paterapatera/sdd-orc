import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { cliPath, commitAll, git, initRepo, run, sdd, tempRepo, writeInvoiceIssue, writeSteering } from "./helpers.mjs";

function read(dir, rel) {
  return fs.readFileSync(path.join(dir, rel), "utf8");
}

function prepare(dir) {
  assert.equal(initRepo(dir).status, 0);
  writeSteering(dir);
  assert.equal(sdd(dir, ["index"]).status, 0);
  commitAll(dir, "chore: skeleton");
}

test("init, update, and migrate install one shared script", () => {
  const dir = tempRepo();
  const created = initRepo(dir, ["--skills-dir", ".agents", "--skills-dir", ".claude", "--lang", "ja", "--runtime", "bun"]);
  assert.equal(created.status, 0, created.stderr + created.stdout);
  const config = JSON.parse(read(dir, "sdd.config.json"));
  assert.equal(config.version, "0.3.0");
  assert.equal(config.formatVersion, 1);
  assert.equal(config.lang, "ja");
  assert.deepEqual(config.skillsDir, [".agents", ".claude"]);
  assert.equal(fs.existsSync(path.join(dir, ".agents/skills/sdd-scripts/sdd.mjs")), true);
  assert.equal(fs.existsSync(path.join(dir, ".claude/skills/sdd-scripts/sdd.mjs")), false);
  assert.equal(fs.existsSync(path.join(dir, "docs/sdd/steering")), false);
  assert.match(read(dir, "docs/sdd/index.md"), /okf_version: "0\.2"/);
  assert.match(read(dir, "docs/sdd/specs/index.md"), /仕様/);
  const skill = read(dir, ".agents/skills/sdd-init/SKILL.md");
  assert.match(skill, /bun \.agents\/skills\/sdd-scripts\/sdd\.mjs check --scope setup/);
  assert.doesNotMatch(skill, /__SDD_/);
  assert.match(read(dir, ".claude/skills/sdd-close/SKILL.md"), /bun \.agents\/skills\/sdd-scripts\/sdd\.mjs/);
  assert.match(read(dir, ".agents/skills/sdd-scripts/sdd.mjs"), /^#!\/usr\/bin\/env node/);
  assert.doesNotMatch(read(dir, ".agents/skills/sdd-scripts/sdd.mjs"), /from "\.\/|from '\.\//);

  const setup = sdd(dir, ["check", "--scope", "setup"]);
  assert.equal(setup.status, 1);
  assert.match(setup.stdout, /SETUP_STEERING_MISSING/);
  assert.equal(initRepo(dir, ["--skills-dir", ".agents", "--skills-dir", ".claude", "--lang", "ja", "--runtime", "bun"]).status, 0);
  const changed = initRepo(dir, ["--lang", "en"]);
  assert.equal(changed.status, 2);
  assert.match(changed.stderr, /--force/);
  fs.writeFileSync(path.join(dir, "docs/sdd/README.md"), "# notes\n");
  const stray = initRepo(dir, ["--force", "--lang", "en"]);
  assert.equal(stray.status, 2);
  assert.match(stray.stderr, /dedicated --docs-dir/);
  fs.rmSync(path.join(dir, "docs/sdd/README.md"));

  fs.writeFileSync(path.join(dir, "docs/sdd/specs/billing.md"), "keep\n");
  const updated = run([cliPath, "update"], dir);
  assert.equal(updated.status, 0, updated.stderr);
  assert.equal(read(dir, "docs/sdd/specs/billing.md"), "keep\n");
  const migrated = run([cliPath, "migrate"], dir);
  assert.equal(migrated.status, 0);
  assert.match(migrated.stdout, /Nothing to convert/);
  config.formatVersion = 0;
  fs.writeFileSync(path.join(dir, "sdd.config.json"), `${JSON.stringify(config, null, 2)}\n`);
  const needsMigrate = run([cliPath, "update"], dir);
  assert.equal(needsMigrate.status, 2);
  assert.match(needsMigrate.stdout, /migrate is required/);
  assert.equal(JSON.parse(read(dir, "sdd.config.json")).formatVersion, 0);
});

test("index regenerates descriptions and setup passes after steering", () => {
  const dir = tempRepo();
  prepare(dir);
  const setup = sdd(dir, ["check", "--scope", "setup", "--format", "json"]);
  assert.equal(setup.status, 0, setup.stdout);
  assert.equal(JSON.parse(setup.stdout).ok, true);
  assert.match(read(dir, "docs/sdd/index.md"), /\/steering\//);
  assert.match(read(dir, "docs/sdd/steering/index.md"), /# product/);
  const version = sdd(dir, ["check"]);
  assert.equal(version.status, 0, version.stdout);
  const config = JSON.parse(read(dir, "sdd.config.json"));
  config.formatVersion = 9;
  fs.writeFileSync(path.join(dir, "sdd.config.json"), `${JSON.stringify(config, null, 2)}\n`);
  const mismatch = sdd(dir, ["check", "--scope", "setup"]);
  assert.equal(mismatch.status, 2);
  assert.match(mismatch.stdout, /FORMAT_VERSION/);
});

test("apply adds one invoice requirement and replaces provisional ids", () => {
  const dir = tempRepo();
  prepare(dir);
  writeInvoiceIssue(dir);
  commitAll(dir, "docs: proposal");
  const applied = sdd(dir, ["apply", "--issue", "invoice-reissue"]);
  assert.equal(applied.status, 0, applied.stdout);
  const spec = read(dir, "docs/sdd/specs/billing/invoice/spec.md");
  assert.match(spec, /### REQ-INV-1: Issue invoice on confirmation/);
  assert.match(spec, /SHALL issue an invoice/);
  assert.match(spec, /Code: INV/);
  assert.doesNotMatch(spec, /NEW/);
  assert.match(read(dir, "docs/sdd/specs/log.md"), /\*\*Added\*\*: REQ-INV-1/);
  assert.match(read(dir, "docs/sdd/specs/billing/index.md"), /\/specs\/billing\/invoice\//);
  assert.match(read(dir, "src/invoice.js"), /REQ-INV-1/);
  assert.doesNotMatch(read(dir, "src/invoice.js"), /NEW/);
  const again = sdd(dir, ["apply", "--issue", "invoice-reissue"]);
  assert.equal(again.status, 0, again.stdout);
  const closed = sdd(dir, ["check", "--stage", "close", "--issue", "invoice-reissue"]);
  assert.equal(closed.status, 0, closed.stdout);
});

test("stamp records base and apply refuses a stale replacement", () => {
  const dir = tempRepo();
  prepare(dir);
  writeInvoiceIssue(dir);
  commitAll(dir, "docs: proposal");
  assert.equal(sdd(dir, ["apply", "--issue", "invoice-reissue"]).status, 0);
  const requirements = path.join(dir, "docs/sdd/issues/invoice-reissue/requirements.md");
  fs.appendFileSync(requirements, `
### MODIFIED
#### REQ-INV-1: Issue invoice on confirmation
- change: Record the invoice number.
When an order is confirmed, the system SHALL issue a numbered invoice.

##### Scenario: Issue on confirmation
- **Given** a confirmed order
- **When** the confirmation is recorded
- **Then** a numbered invoice is issued
`);
  const design = read(dir, "docs/sdd/issues/invoice-reissue/design.md");
  fs.writeFileSync(path.join(dir, "docs/sdd/issues/invoice-reissue/design.md"), design.replace("| REQ-INV-NEW-1 |", "| REQ-INV-1 |"));
  const task = read(dir, "docs/sdd/issues/invoice-reissue/task.md");
  fs.writeFileSync(path.join(dir, "docs/sdd/issues/invoice-reissue/task.md"), task.replaceAll("REQ-INV-NEW-1", "REQ-INV-1"));
  assert.equal(sdd(dir, ["stamp", "--issue", "invoice-reissue"]).status, 0);
  assert.match(read(dir, "docs/sdd/issues/invoice-reissue/requirements.md"), /- base: [0-9a-f]{12}/);
  const specPath = path.join(dir, "docs/sdd/specs/billing/invoice/spec.md");
  const original = fs.readFileSync(specPath, "utf8");
  fs.writeFileSync(specPath, original.replace("issue an invoice", "issue a draft invoice"));
  const rejected = sdd(dir, ["apply", "--issue", "invoice-reissue"]);
  assert.equal(rejected.status, 1);
  assert.match(rejected.stdout, /BASE_MISMATCH/);
  assert.match(rejected.stdout, /draft invoice/);
  assert.match(rejected.stdout, /numbered invoice/);
  assert.match(fs.readFileSync(specPath, "utf8"), /draft invoice/);
});

test("contracts, removal, and empty requirements are checked", () => {
  const dir = tempRepo();
  prepare(dir);
  writeInvoiceIssue(dir);
  commitAll(dir, "docs: proposal");
  assert.equal(sdd(dir, ["apply", "--issue", "invoice-reissue"]).status, 0);
  fs.mkdirSync(path.join(dir, "api"), { recursive: true });
  fs.writeFileSync(path.join(dir, "api/openapi.yaml"), "openapi: 3.0.0\n");
  commitAll(dir, "chore: api");
  const requirements = path.join(dir, "docs/sdd/issues/invoice-reissue/requirements.md");
  fs.appendFileSync(requirements, `
## /specs/billing/invoice/interfaces.md

### METADATA
- title: Invoice API
- description: Invoice issue contract.
- tags: [billing]

### SECTIONS
#### Purpose
Expose invoice issue.

### ADDED
#### IF-INV-NEW-1: Issue invoice
- Kind: REST API
- Direction: Provided
- Counterpart: External: Billing desk
- Source: \`api/openapi.yaml#/paths/~1invoices/post\`
- Compatibility: Backward compatible changes only

The system SHALL accept an order id and return an invoice id.

## /specs/billing/invoice/data.md

### METADATA
- title: Invoice record
- description: Persisted invoice.
- tags: [billing]

### SECTIONS
#### Purpose
Store issued invoices.

### ADDED
#### DATA-INV-NEW-1: Invoice
- Classification: Confidential
- Retention: 7 years

The system SHALL persist an invoice.

| Element | Type | Required | Constraints | Description |
|---|---|---|---|---|
| invoiceId | string | yes | unique | Identifier |

## /specs/billing/invoice/quality.md

### METADATA
- title: Invoice quality
- description: Invoice latency.
- tags: [billing]

### SECTIONS
#### Purpose
Bound invoice latency.

### ADDED
#### NFR-INV-NEW-1: Invoice latency
- Characteristic: Performance efficiency
- Measure: p95 latency
- Target: <= 200 ms
- Condition: 50 rps
- Verification: Test

The system SHALL answer within 200 ms at p95.
`);
  let text = fs.readFileSync(requirements, "utf8");
  text = text.replace("no change: no contract", "changed").replace("no change: no persisted data", "changed").replace("no change: no quality target", "changed");
  fs.writeFileSync(requirements, text);
  for (const id of ["IF-INV-NEW-1", "DATA-INV-NEW-1", "NFR-INV-NEW-1"]) {
    const design = read(dir, "docs/sdd/issues/invoice-reissue/design.md");
    fs.writeFileSync(path.join(dir, "docs/sdd/issues/invoice-reissue/design.md"), design.replace("| REQ-INV-NEW-1 | InvoiceService | Integration |", `| REQ-INV-NEW-1 | InvoiceService | Integration |\n| ${id} | InvoiceService | Contract |`));
    const task = read(dir, "docs/sdd/issues/invoice-reissue/task.md");
    fs.writeFileSync(path.join(dir, "docs/sdd/issues/invoice-reissue/task.md"), task.replace("Requirements: REQ-INV-NEW-1", `Requirements: REQ-INV-NEW-1, ${id}`));
  }
  const applied = sdd(dir, ["apply", "--issue", "invoice-reissue"]);
  assert.equal(applied.status, 0, applied.stdout);
  assert.match(read(dir, "docs/sdd/specs/billing/invoice/interfaces.md"), /IF-INV-1/);
  assert.match(read(dir, "docs/sdd/specs/billing/invoice/data.md"), /DATA-INV-1/);
  assert.match(read(dir, "docs/sdd/specs/billing/invoice/quality.md"), /NFR-INV-1/);

  let removal = fs.readFileSync(requirements, "utf8");
  removal = removal.replace(
    "- **Then** an invoice is issued\n",
    "- **Then** an invoice is issued\n\n### REMOVED\n#### REQ-INV-1\n- reason: Replaced by manual approval.\n",
  );
  fs.writeFileSync(requirements, removal);
  const design = read(dir, "docs/sdd/issues/invoice-reissue/design.md");
  fs.writeFileSync(path.join(dir, "docs/sdd/issues/invoice-reissue/design.md"), design.replace(
    "| REQ-INV-NEW-1 | InvoiceService | Integration |",
    "| REQ-INV-NEW-1 | InvoiceService | Integration |\n| REQ-INV-1 | InvoiceService | Integration |",
  ));
  const task = read(dir, "docs/sdd/issues/invoice-reissue/task.md");
  fs.writeFileSync(path.join(dir, "docs/sdd/issues/invoice-reissue/task.md"), task.replace(
    "Requirements: REQ-INV-NEW-1",
    "Requirements: REQ-INV-NEW-1, REQ-INV-1",
  ));
  const removed = sdd(dir, ["stamp", "--issue", "invoice-reissue"]);
  assert.equal(removed.status, 0, removed.stdout);
  const failed = sdd(dir, ["apply", "--issue", "invoice-reissue"]);
  assert.equal(failed.status, 1, failed.stdout);
  assert.match(failed.stdout, /REQ_EMPTY/);
  assert.match(read(dir, "docs/sdd/specs/billing/invoice/spec.md"), /REQ-INV-1/);
});

test("structure operations move, split, and record former codes", () => {
  const dir = tempRepo();
  prepare(dir);
  writeInvoiceIssue(dir);
  const requirements = path.join(dir, "docs/sdd/issues/invoice-reissue/requirements.md");
  fs.appendFileSync(requirements, `
### ADDED
#### REQ-INV-NEW-2: Void an invoice
When a clerk voids an invoice, the system SHALL mark that invoice void.

##### Scenario: Void
- **Given** an issued invoice
- **When** the clerk voids it
- **Then** the invoice is void
`);
  const design = read(dir, "docs/sdd/issues/invoice-reissue/design.md");
  fs.writeFileSync(path.join(dir, "docs/sdd/issues/invoice-reissue/design.md"), design.replace("| REQ-INV-NEW-1 | InvoiceService | Integration |", "| REQ-INV-NEW-1 | InvoiceService | Integration |\n| REQ-INV-NEW-2 | InvoiceService | Unit |"));
  const task = read(dir, "docs/sdd/issues/invoice-reissue/task.md");
  fs.writeFileSync(path.join(dir, "docs/sdd/issues/invoice-reissue/task.md"), `${task}\n    - Requirements: REQ-INV-NEW-2\n`);
  commitAll(dir, "docs: proposal");
  const first = sdd(dir, ["apply", "--issue", "invoice-reissue"]);
  assert.equal(first.status, 0, first.stdout);
  fs.writeFileSync(requirements, `# Requirements

## Context
- Actors: Clerk
- Current behavior: REQ-INV-1 and REQ-INV-2
- Assumptions:
  - Voids become adjustments.

## Open Questions

# Delta

## Coverage
| capability | spec.md | interfaces.md | data.md | quality.md |
|---|---|---|---|---|
| /specs/finance/invoice | no change: moved | no change: no contract | no change: no data | no change: no quality |
| /specs/finance/adjustment | changed | no change: no contract | no change: no data | no change: no quality |

## Structure

### MOVED
- from: /specs/billing/invoice
  to: /specs/finance/invoice

### SPLIT
- from: /specs/finance/invoice
  into:
    - to: /specs/finance/adjustment
      ids: [REQ-INV-2]

## New domain: /specs/finance

- title: Finance
- description: Finance capabilities.

## New capability: /specs/finance/adjustment

- Code: ADJ
- title: Adjustment
- description: Adjusts invoices.
- tags: [billing]

## /specs/finance/adjustment/spec.md

### SECTIONS
#### Purpose
Adjustments group voids.

#### Scope
- In: voids
- Out: refunds
`);
  fs.writeFileSync(path.join(dir, "docs/sdd/issues/invoice-reissue/design.md"), `# Design

## Overview
Move invoices and split voids.

## Requirements Traceability
none

## Components and Interfaces
### InvoiceService
- Location: src/invoice/ (modified)
- Responsibility: Issue invoices.
- Depends on: none
- Provides: issue(orderId)

## Data Model
none

## Error Handling
none

## Testing Strategy
Run the full existing test suite to confirm behavior is unchanged.

## Migration
none
`);
  fs.writeFileSync(path.join(dir, "docs/sdd/issues/invoice-reissue/task.md"), `# Tasks

- [x] 1. Split voids
  - 1.1 Move the requirement
  - 1.2 Run the full existing test suite
`);
  const moved = sdd(dir, ["apply", "--issue", "invoice-reissue"]);
  assert.equal(moved.status, 0, moved.stdout);
  assert.match(read(dir, "docs/sdd/specs/finance/adjustment/spec.md"), /REQ-INV-2/);
  assert.match(read(dir, "docs/sdd/specs/finance/adjustment/spec.md"), /Former codes: INV/);
  assert.match(read(dir, "docs/sdd/specs/finance/invoice/spec.md"), /REQ-INV-1/);
  assert.doesNotMatch(read(dir, "docs/sdd/specs/finance/invoice/spec.md"), /REQ-INV-2/);
  assert.match(read(dir, "docs/sdd/specs/log.md"), /\*\*Moved\*\*/);
  assert.match(read(dir, "docs/sdd/specs/log.md"), /\*\*Split\*\*/);
});

test("ADR apply supersedes, amends metadata, and rejects outcome edits", () => {
  const dir = tempRepo();
  prepare(dir);
  const issue = path.join(dir, "docs/sdd/issues/choose-mail");
  fs.mkdirSync(issue, { recursive: true });
  fs.writeFileSync(path.join(issue, "proposal.md"), `# Choose mail

## Why
- Background: Mail has no provider.
- Affected: Customers
- Outcome: One provider is chosen.

## What Changes
- Transactional mail uses one provider.

## Impact
- Type: docs
- Capabilities: none
- Steering: /steering/tech.md - Stack
- Decisions: Candidate - mail provider
- Code: none

## Out of Scope
- SMS
`);
  fs.writeFileSync(path.join(issue, "requirements.md"), `# Requirements

## Context
- Actors: Customer
- Current behavior: none
- Assumptions:
  - Specs do not change.

## Open Questions

# Delta

## Coverage
none
`);
  fs.writeFileSync(path.join(issue, "research.md"), `# Research

## Questions
- RQ1: Which provider fits?

## Findings
### RQ1
- Provider A supports suppression. (source: https://example.com, accessed 2026-10-26)

## Options
### D1: Mail provider
- Drivers: cost
- Related: RQ1

| Option | Pros | Cons |
|---|---|---|
| Provider A | suppression | price |

## Conclusions
- D1: Provider A -> ADR-NEW-1

# Delta

## ADDED
### ADR-NEW-1: Use Provider A for transactional email
- description: Provider A sends transactional email.
- tags: [mail]

#### Context and Problem Statement
Mail needs a provider.

#### Decision Drivers
- Deliverability

#### Considered Options
- Provider A

#### Decision Outcome
Use Provider A.

##### Consequences
- Vendor lock-in is accepted.

#### Related
- Provider A
`);
  fs.writeFileSync(path.join(issue, "design.md"), `# Design

## Overview
Use Provider A (D1).

## Requirements Traceability
none

## Components and Interfaces
### MailClient
- Location: src/mail/ (new)
- Responsibility: Send mail.
- Depends on: Provider A
- Provides: send()

## Data Model
none

## Error Handling
none

## Testing Strategy
Run the full existing test suite to confirm behavior is unchanged.

| Test Level | Runs on | Notes |
|---|---|---|
| Unit | Local | existing tests |

## Migration
none
`);
  fs.writeFileSync(path.join(issue, "task.md"), `# Tasks

- [x] 1. Record the decision
  - 1.1 Write the ADR
  - 1.2 Run the full existing test suite
`);
  commitAll(dir, "docs: mail");
  const applied = sdd(dir, ["apply", "--issue", "choose-mail"]);
  assert.equal(applied.status, 0, applied.stdout);
  const adr = fs.readdirSync(path.join(dir, "docs/sdd/decision")).find((name) => name.startsWith("1-"));
  assert.match(read(dir, `docs/sdd/decision/${adr}`), /Status\nAccepted/);
  assert.match(read(dir, "docs/sdd/decision/index.md"), /# mail/);
  fs.appendFileSync(path.join(issue, "research.md"), `
## SUPERSEDED
### ADR-1 -> ADR-NEW-2

## ADDED
### ADR-NEW-2: Use Provider B for transactional email
- description: Provider B replaces Provider A.
- tags: [mail]

#### Context and Problem Statement
Provider A is withdrawn.

#### Decision Drivers
- Availability

#### Considered Options
- Provider B

#### Decision Outcome
Use Provider B.

#### Related
- Provider B

## AMENDED
### ADR-1
#### Decision Outcome
Use neither provider.
`);
  let research = read(dir, "docs/sdd/issues/choose-mail/research.md");
  research = research.replace("D1: Provider A -> ADR-NEW-1", "D1: Provider A -> ADR-NEW-1\n- D2: Replacement -> ADR-NEW-2");
  research = research.replace("### D1: Mail provider", "### D1: Mail provider\n### D2: Replacement");
  fs.writeFileSync(path.join(dir, "docs/sdd/issues/choose-mail/research.md"), research);
  const amended = sdd(dir, ["apply", "--issue", "choose-mail"]);
  assert.equal(amended.status, 1, amended.stdout);
  assert.match(amended.stdout, /AMENDED_SCOPE/);
  research = read(dir, "docs/sdd/issues/choose-mail/research.md").replace("#### Decision Outcome\nUse neither provider.\n", "- title: Use Provider A for transactional email\n");
  fs.writeFileSync(path.join(dir, "docs/sdd/issues/choose-mail/research.md"), research);
  const superseded = sdd(dir, ["apply", "--issue", "choose-mail"]);
  assert.equal(superseded.status, 0, superseded.stdout);
  assert.match(read(dir, `docs/sdd/decision/${adr}`), /Superseded by ADR-2/);
});

test("renumber changes only the duplicate id added on this branch", () => {
  const dir = tempRepo();
  prepare(dir);
  writeInvoiceIssue(dir);
  commitAll(dir, "docs: proposal");
  assert.equal(sdd(dir, ["apply", "--issue", "invoice-reissue"]).status, 0, sdd(dir, ["apply", "--issue", "invoice-reissue"]).stdout);
  commitAll(dir, "docs: invoice");
  const spec = path.join(dir, "docs/sdd/specs/billing/invoice/spec.md");
  const baseSpec = read(dir, "docs/sdd/specs/billing/invoice/spec.md");
  const featureBlock = "### REQ-INV-2: Feature copy\nWhen a clerk reprints an invoice, the system SHALL reprint it.\n\n#### Scenario: Reprint\n- **Given** an invoice\n- **When** the clerk reprints it\n- **Then** a copy is issued\n";
  const mainBlock = "### REQ-INV-2: Main copy\nWhen the system archives an invoice, the system SHALL archive it.\n\n#### Scenario: Archive\n- **Given** an invoice\n- **When** the archive job runs\n- **Then** the invoice is archived\n";
  git(["checkout", "-b", "other-invoice"], dir);
  fs.writeFileSync(spec, `${baseSpec.trim()}\n\n${featureBlock}`);
  fs.writeFileSync(path.join(dir, "src/extra.js"), "// added REQ-INV-2\n");
  commitAll(dir, "feat: feature copy");
  git(["checkout", "main"], dir);
  fs.writeFileSync(spec, `${baseSpec.trim()}\n\n${mainBlock}`);
  commitAll(dir, "feat: main copy");
  git(["checkout", "other-invoice"], dir);
  fs.writeFileSync(spec, `${baseSpec.trim()}\n\n${featureBlock}\n${mainBlock}`);
  const numbered = sdd(dir, ["renumber", "--base", "main"]);
  assert.equal(numbered.status, 0, numbered.stdout + numbered.stderr);
  const after = read(dir, "docs/sdd/specs/billing/invoice/spec.md");
  assert.match(after, /### REQ-INV-2: Main copy/);
  assert.match(after, /### REQ-INV-3: Feature copy/);
  assert.match(read(dir, "src/extra.js"), /REQ-INV-3/);
  assert.match(read(dir, "docs/sdd/specs/log.md"), /REQ-INV-1/);
  assert.doesNotMatch(read(dir, "docs/sdd/specs/log.md"), /REQ-INV-3/);
  assert.doesNotMatch(after, /\u0000/);
});

test("issue checks cover traceability, research, ears, and close", () => {
  const dir = tempRepo();
  prepare(dir);
  writeInvoiceIssue(dir);
  const broken = sdd(dir, ["check", "--issue", "invoice-reissue"]);
  assert.equal(broken.status, 0, broken.stdout);
  fs.writeFileSync(path.join(dir, "docs/sdd/issues/invoice-reissue/task.md"), `# Tasks

- [ ] 1. Issue invoice
  - Depends on: 2
  - 1.1 Create the invoice service
    - Requirements: REQ-INV-NEW-1
`);
  const depends = sdd(dir, ["check", "--issue", "invoice-reissue"]);
  assert.match(depends.stdout, /TASK_DEPENDS/);
  fs.writeFileSync(path.join(dir, "docs/sdd/issues/invoice-reissue/requirements.md"), read(dir, "docs/sdd/issues/invoice-reissue/requirements.md").replace("SHALL", "should"));
  const ears = sdd(dir, ["check", "--issue", "invoice-reissue"]);
  assert.match(ears.stdout, /EARS_SHALL/);
  const close = sdd(dir, ["check", "--stage", "close", "--issue", "invoice-reissue"]);
  assert.match(close.stdout, /CLOSE_TASKS/);
});

test("init through close check ships one package version", () => {
  const dir = tempRepo();
  prepare(dir);
  git(["checkout", "-b", "invoice-reissue"], dir);
  writeInvoiceIssue(dir);
  commitAll(dir, "docs: proposal");
  const applied = sdd(dir, ["apply"]);
  assert.equal(applied.status, 0, applied.stdout);
  const closed = sdd(dir, ["check", "--stage", "close"]);
  assert.equal(closed.status, 0, closed.stdout);
  const version = sdd(dir, ["--version"]);
  const config = JSON.parse(read(dir, "sdd.config.json"));
  assert.equal(version.status, 0, version.stderr);
  assert.equal(version.stdout.trim(), config.version);
  assert.equal(config.version, "0.3.0");
  assert.match(read(dir, "docs/sdd/specs/billing/invoice/spec.md"), /REQ-INV-1/);
  assert.doesNotMatch(read(dir, "src/invoice.js"), /-NEW-/);
});
