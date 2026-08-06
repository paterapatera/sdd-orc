---
name: kiro-validate-requirements-sec
description: Autonomous requirements-phase security review. AuthN/AuthZ, PII, trust boundaries, abuse cases, compliance. Records adopt/defer in reviews/requirements-sec.md. Use after /kiro-validate-requirements-qa (po → qa → sec → ex) in AI-DLC flow. No user dialogue.
metadata:
  shared-rules: "../kiro-validate-shared/contract.md"
---

# Validate Requirements (Security)

<background_information>
Third requirements-phase validate (po → qa → sec → ex). Security administrator role. Recommendations and adopt/defer decisions go to `reviews/requirements-sec.md` `## Decisions`.
</background_information>

<instructions>
## Inputs

- Feature: `$1`
- `docs/specs/$1/requirements.md` (PO- and QA-validated)
- `docs/specs/$1/reviews/requirements-qa.md` (`VERDICT: GO` required)
- Steering security constraints (`docs/steering/` — load security-relevant files only)

## Execution

1. Read `../kiro-validate-shared/contract.md` if not already loaded this session.
2. Read `rules/sec-requirements-checklist.md` from this skill directory.
3. Review per checklist; update `requirements.md` only when adopting a recommendation.
4. Write `docs/specs/$1/reviews/requirements-sec.md` per contract format.
5. Fresh-evidence check before `VERDICT: GO`.

## Update mode

When `/kiro-orchestrate` runs an update flow (要求更新 — not new creation), scope work to **security impact of changed requirements only** per `../kiro-validate-shared/contract.md` Update Flows. Re-audit unchanged ACs only when a change materially affects their trust boundary or data handling. Update `requirements.md` and `## Decisions` only for adopted changes in scope.

## Constraints

- Do not decide functional scope (PO domain) or re-run testability review (qa domain).
- Do not undo or contradict fixes recorded in `reviews/requirements-po.md` / `reviews/requirements-qa.md` — `/kiro-validate-requirements-ex` verifies this.
- Every `requirements.md` edit must appear as a `## Reflected Fixes` row.
- Do not ask the user questions.

## On NO-GO

Orchestrator rolls back to `/kiro-spec-requirements` or `requirements.md` fix, then re-runs po → qa → sec → `/kiro-validate-requirements-ex`.
</instructions>

## Safety

- Missing PO report with `VERDICT: GO` or `requirements.md` → stop: run `/kiro-validate-requirements $1` first.
- Missing QA report with `VERDICT: GO` → stop: run `/kiro-validate-requirements-qa $1` first.
