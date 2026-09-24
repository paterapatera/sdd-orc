---
name: sdd-spec-requirements
description: Orchestrator-only. Initializes the spec if needed (Step 0), then generates EARS requirements.md from the grilled brief. Never asks the human; unresolved scope becomes Open question bullets for the req grill. Dispatched by /sdd-orchestrate (要求ブロック step 2, and inside sdd-spec-quick).
metadata:
  shared-rules: "ears-format.md, requirements-review-gate.md"
disable-model-invocation: true
---


# Requirements Generation

<background_information>
Run only from `/sdd-orchestrate` (要求ブロック step 2) or `/sdd-spec-quick` (S quick-path). `$1` is the feature already resolved by the orchestrator. `brief.md` exists and its brief grill is READY, except on Path A 要求更新, where there may be no brief (then `requirements.md` + the update request written into it are the source).

- **Success Criteria**:
  - `spec.json` + stub `requirements.md` exist (Step 0 when missing)
  - Complete requirements document aligned with steering context
  - EARS patterns for all acceptance criteria
  - WHAT, not HOW
  - Inclusion/exclusion boundaries explicit when scope could otherwise be misread
  - Anything the sources do not settle is an `Open question:` bullet — never a guess, never a question to the human
  - Metadata updated to track generation status
</background_information>

<instructions>
## Never ask the human

The req grill (`/sdd-grill <feature> req`) runs right after this skill (in S, `/sdd-spec-quick` escalates to M instead). Wherever an unclear intent, scope ambiguity, contradiction, or incomplete coverage appears:

1. Write the requirements the sources do settle. Do not guess the rest.
2. Record each unresolved point as one bullet under `## スコープ境界` (create after はじめに if missing): `Open question: <何が決まっていないか>（<関連する要件 ID / brief の引用>）`.
3. Finish normally (Step 5). The req grill treats every `Open question:` as a BLOCKER.

## Execution Steps

### Step 0: Initialize (if needed)

Skip when `docs/specs/$1/spec.json` already exists.

1. Read `docs/specs/$1/brief.md`. It supplies the project description: (a) who has the problem, (b) current situation, (c) what should change. A missing element becomes an `Open question:` in Step 3; do not fill it with assumptions.
2. Initialize from templates (reuse existing paths — do not move templates):
   - Read `docs/settings/templates/specs/init.json` and `docs/settings/templates/specs/requirements-init.md`
   - Replace placeholders: `{{FEATURE_NAME}}` (= `$1`), `{{TIMESTAMP}}` (ISO 8601), `{{PROJECT_DESCRIPTION}}` (from brief), language (`ja` / detect from brief, default `en`)
   - Write `spec.json` and stub `requirements.md` (requirements-init template only)
3. Do **not** generate EARS bodies in this step. Do **not** set `approvals.requirements.generated: true`.

### Step 1: Load Context

- `docs/specs/$1/spec.json` for language and metadata
- `docs/specs/$1/brief.md` if it exists (Desired Outcome, Scope, Route; optional Background / Approach / Current State / deps / Constraints; grill Residual notes)
- `docs/specs/$1/requirements.md` for project description (and existing requirements in 要求更新)
- Core steering: `product.md`, `tech.md`, `structure.md`
- Additional steering files only when directly relevant to feature scope, user personas, business/domain rules, compliance/security constraints, operational constraints, or existing product boundaries
- Relevant local agent skills or playbooks only when they clearly match the feature's host environment or use case and contain domain terminology or workflow rules that shape user-observable requirements

Persistent docs: `docs/architecture/**` / `docs/contracts/**` are **optional**, related files only if needed for scope clarity — never glob-bulk-Read; path is always index → named file. Do not author contract bodies here (design owns them). Do not “read everything just in case”.

### Step 2: Read Guidelines

- `rules/ears-format.md` (EARS syntax)
- `rules/requirements-review-gate.md` (pre-write review criteria)
- `docs/settings/templates/specs/requirements.md` (document structure)

#### Parallel Research (sub-agent dispatch)

Keep in main context: spec files, EARS rules, review gate, template, `product.md`, `tech.md`. Decide the decomposition by complexity — split, merge, add, or skip:

- **Codebase hints** (brownfield): a sub-agent summarizes (1) what already exists, (2) relevant interfaces/APIs, (3) patterns new requirements should align with. Under 150 lines.
- **Domain research** (when external knowledge is needed): a sub-agent returns a concise findings summary.
- **Additional steering and playbooks**: if many exist, a sub-agent returns only the sections relevant to this feature.

Greenfield with minimal codebase: skip sub-agents. Synthesize findings in main context before generating.

### Step 3: Generate Requirements Draft

- Group related functionality into logical requirement areas; EARS for every AC; language from `spec.json`
- 要求更新: change only what the update requires; keep unrelated requirement IDs and text
- Terminology continuity across phases: discovery = Scope In/Out (+ optional Approach; no EARS) → requirements = explicit inclusion/exclusion and adjacent expectations when needed → design = `Boundary Commitments` → tasks = `_Boundary:_`
- If scope could be misread, add lightweight boundary context without implementation or architecture ownership detail
- Keep as a draft until the review gate passes

### Step 4: Review Requirements Draft

- Run the Requirements Review Gate (`rules/requirements-review-gate.md`): coverage, EARS compliance, ambiguity, adjacent expectations, scope boundaries
- Repair local issues and review again; at most 2 repair passes
- A real scope ambiguity or contradiction becomes an `Open question:` (§ Never ask the human), not a guessed requirement

### Step 5: Finalize and Update Metadata

- Write `docs/specs/$1/requirements.md`
- Set `phase: "requirements-generated"`, `approvals.requirements.generated: true`, update `updated_at`

## Scope rules

`brief.md` is a capture artifact, not a requirements substitute: expand thin briefs here. Brownfield codebase research runs here, not in discovery. Do not expect Boundary Candidates tables, approach Pros/Cons, or viability notes in the brief.

**WHAT, not HOW.** Requirements cover: functional scope (in / out), user-observable behavior, business rules and edge cases, user-visible NFRs (response time, availability, security level), and adjacent expectations only when they change user-visible or operator behavior. They do **not** cover: technology stack, architecture patterns, API design / data models / internal structure, how NFRs are achieved, internal ownership or component seams.

**Litmus test**: if an EARS acceptance criterion can be written without mentioning any technology, it belongs in requirements. If it requires a technology choice, it belongs in design.

- Each requirement must be testable and unambiguous. Where the sources allow several interpretations of scope, behavior, or boundary conditions, write an `Open question:` instead of choosing one.
- Choose an appropriate subject for EARS statements (system/service name for software).
- Requirement headings MUST use a leading numeric ID only ("Requirement 1", "1.", "2 Feature ..."); never alphabetic IDs. Normalize existing non-numeric headings and keep the mapping consistent.
</instructions>

## Return to the orchestrator

In the spec language, under 100 words: requirement areas (3–5 bullets), whether Step 0 initialized the spec, review gate passed, and the number of `Open question:` bullets.

## Safety & Fallback

- **No `brief.md` and no `spec.json`**: stop; report to the orchestrator (discovery has not run).
- **Step 0 must not** set `approvals.requirements.generated: true` or write EARS bodies.
- **Template missing**: Step 0 init templates → stop and report the path. Requirements template → inline fallback structure with a warning.
- **Language undefined**: default `en`.
- **Steering directory empty**: note it in the return; continue.
