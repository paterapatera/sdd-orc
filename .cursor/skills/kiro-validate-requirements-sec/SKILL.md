---
name: kiro-validate-requirements-sec
description: Autonomous requirements-phase security review. AuthN/AuthZ, PII, trust boundaries, compliance. Records adopt/defer in reviews/requirements-sec.md. Use after /kiro-validate-requirements in AI-DLC flow. No user dialogue.
metadata:
  shared-rules: "../kiro-validate-shared/contract.md"
---

# Validate Requirements (Security)

<background_information>
Second requirements-phase validate (after PO). Security administrator role. Recommendations and adopt/defer decisions go to `reviews/requirements-sec.md` `## Decisions`.
</background_information>

<instructions>
## Inputs

- Feature: `$1`
- `docs/specs/$1/requirements.md` (PO-validated)
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

- Do not decide functional scope (PO domain).
- Do not ask the user questions.

## On NO-GO

Orchestrator rolls back to `/kiro-spec-requirements` or `requirements.md` fix, then re-runs po → sec.
</instructions>

## Safety

- Missing PO report with `VERDICT: GO` or `requirements.md` → stop: run `/kiro-validate-requirements $1` first.
