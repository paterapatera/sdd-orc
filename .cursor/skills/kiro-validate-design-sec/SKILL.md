---
name: kiro-validate-design-sec
description: Autonomous design security review. Threat model, credentials, PII handling. Security administrator role. Reflects fixes into design.md. Use after /kiro-validate-design-arch in AI-DLC flow. No user dialogue.
metadata:
  shared-rules: "../kiro-validate-shared/contract.md"
---

# Validate Design (Security)

<background_information>
Third design-phase specialist validate. Reads arch-updated `design.md`. After all three GO, orchestrator runs `/kiro-validate-design-ex` as final gate.
</background_information>

<instructions>
## Inputs

- Feature: `$1`
- `docs/specs/$1/requirements.md`
- `docs/specs/$1/design.md` (after arch reflection)
- `docs/specs/$1/reviews/requirements-sec.md` (for requirements-phase security decisions)
- Steering security constraints

## Execution

1. Read `../kiro-validate-shared/contract.md` if not already loaded this session.
2. Read `rules/sec-design-checklist.md` from this skill directory.
3. Threat model and data-protection review; apply fixes to `design.md`.
4. Write `docs/specs/$1/reviews/design-sec.md` per contract format.
5. Fresh-evidence check before `VERDICT: GO`.

## Update mode

When `/kiro-orchestrate` runs an update flow (要求更新 or 設計更新 — not new creation), scope work to **new or changed surfaces and data paths only** per `../kiro-validate-shared/contract.md` Update Flows. Threat-model and apply `design.md` fixes only for the diff; re-check unchanged areas only when a change shifts trust boundaries or PII handling.

## Constraints

- Do not repeat QA or architecture analysis.
- Do not ask the user questions.

## On NO-GO

Orchestrator rolls back to `/kiro-spec-design`, then re-runs qa → arch → sec → `/kiro-validate-design-ex`.
</instructions>

## Safety

- Missing `design-arch.md` with `VERDICT: GO` → stop: run `/kiro-validate-design-arch $1` first.
