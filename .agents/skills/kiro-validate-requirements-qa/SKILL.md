---
name: kiro-validate-requirements-qa
description: Autonomous requirements-phase testability review. AC verifiability, abnormal-flow AC coverage, boundary conditions, measurable NFRs. Quality administrator role. Reflects fixes into requirements.md. Use after /kiro-validate-requirements (po → qa → sec → ex) in AI-DLC flow. No user dialogue.
metadata:
  shared-rules: "../kiro-validate-shared/contract.md"
---

# Validate Requirements (QA)

<background_information>
Second requirements-phase validate (po → qa → sec → ex). Quality administrator role. Ensures every requirement is verifiable before design-qa has to trace edge cases against it. Judgments go to `reviews/requirements-qa.md` `## Decisions` for the approval gate.
</background_information>

<instructions>
## Inputs

- Feature: `$1`
- `docs/specs/$1/requirements.md` (PO-validated)
- `docs/specs/$1/reviews/requirements-po.md` (`VERDICT: GO` required)

## Execution

1. Read `../kiro-validate-shared/contract.md` if not already loaded this session.
2. Read `rules/qa-requirements-checklist.md` from this skill directory.
3. Review testability per checklist; fix `requirements.md` when local and unambiguous (record each fix as a `## Reflected Fixes` row).
4. Write `docs/specs/$1/reviews/requirements-qa.md` per contract format.
5. Fresh-evidence check before `VERDICT: GO`.

## Update mode

When `/kiro-orchestrate` runs an update flow (要求更新 — not new creation), scope work to **changed requirements and ACs only** per `../kiro-validate-shared/contract.md` Update Flows. Check testability and apply `requirements.md` fixes only for the diff; do not re-audit unchanged requirements.

## Constraints

- Do not decide functional scope or resolve semantic ambiguity (PO domain).
- Do not perform security review (`/kiro-validate-requirements-sec`).
- Do not run EARS mechanical checks (`requirements-review-gate`).
- Do not introduce implementation detail when making NFRs measurable — keep expectations user- or operator-observable.
- Changes to `requirements.md` preserve EARS keyword English (When, If, While, Where, shall).
- Do not ask the user questions.

## On NO-GO

Orchestrator rolls back to `/kiro-spec-requirements` or `requirements.md` fix, then re-runs po → qa → sec → ex.
</instructions>

## Safety

- Missing `requirements.md` → stop: run `/kiro-spec-requirements $1` first.
- Missing PO report with `VERDICT: GO` → stop: run `/kiro-validate-requirements $1` first.
