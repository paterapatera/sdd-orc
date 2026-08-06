---
name: kiro-validate-design-qa
description: Autonomous design review for abnormal flows and edge-case coverage. Quality administrator role. Reflects fixes into design.md. Use after /kiro-spec-design as first design validate (qa → arch → sec). No user dialogue.
metadata:
  shared-rules: "../kiro-validate-shared/contract.md"
---

# Validate Design (QA)

<background_information>
First of three design-phase specialist validates. Serial order required — findings are reflected into `design.md` before arch/sec run.
</background_information>

<instructions>
## Inputs

- Feature: `$1`
- `docs/specs/$1/requirements.md`
- `docs/specs/$1/design.md`

## Execution

1. Read `../kiro-validate-shared/contract.md` if not already loaded this session.
2. Read `rules/qa-checklist.md` from this skill directory.
3. Check edge cases and error paths; apply fixes to `design.md`.
4. Write `docs/specs/$1/reviews/design-qa.md` per contract format.
5. Fresh-evidence check before `VERDICT: GO`.

## Update mode

When `/kiro-orchestrate` runs an update flow (要求更新 or 設計更新 — not new creation), scope work to **changed design sections and linked requirements only** per `../kiro-validate-shared/contract.md` Update Flows. Check edge cases and apply `design.md` fixes only where the diff touches behavior; do not re-audit unchanged design areas.

## Constraints

- Do not perform architecture or security analysis.
- Do not ask the user questions.
- Do not run in parallel with arch/sec (design.md write conflict).

## On NO-GO

Orchestrator rolls back to `/kiro-spec-design`, then re-runs qa → arch → sec → `/kiro-validate-design-ex`.
</instructions>

## Safety

- Missing `design.md` → stop: run `/kiro-spec-design $1` first.
