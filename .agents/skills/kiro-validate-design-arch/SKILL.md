---
name: kiro-validate-design-arch
description: Autonomous design review for SOLID, loose coupling, and extensibility. Architect administrator role. Reflects fixes into design.md. Use after /kiro-validate-design-qa in AI-DLC flow. No user dialogue.
metadata:
  shared-rules: "../kiro-validate-shared/contract.md"
---

# Validate Design (Architecture)

<background_information>
Second design-phase validate. Reads QA-updated `design.md`. Records architectural decisions in `reviews/design-arch.md` `## Decisions`.
</background_information>

<instructions>
## Inputs

- Feature: `$1`
- `docs/specs/$1/requirements.md`
- `docs/specs/$1/design.md` (after QA reflection)
- Core steering: `docs/steering/tech.md`, `structure.md`
- `docs/specs/roadmap.md` if present (existing-asset reuse check)
- `docs/specs/$1/research.md` if present (gap analysis / discovery findings for reuse check)

## Execution

1. Read `../kiro-validate-shared/contract.md` if not already loaded this session.
2. Read `rules/arch-checklist.md` from this skill directory.
3. Review SOLID/coupling/extensibility; apply fixes to `design.md`.
4. Write `docs/specs/$1/reviews/design-arch.md` per contract format.
5. Fresh-evidence check before `VERDICT: GO`.

## Update mode

When `/kiro-orchestrate` runs an update flow (要求更新 or 設計更新 — not new creation), scope work to **changed components and design sections only** per `../kiro-validate-shared/contract.md` Update Flows. Review SOLID, coupling, and extensibility only for the diff; apply `design.md` fixes and record `## Decisions` only where architecture changed.

## Constraints

- Do not repeat QA edge-case checklist or security threat modeling.
- Do not ask the user questions.

## On NO-GO

Orchestrator rolls back to `/kiro-spec-design`, then re-runs qa → arch → sec → `/kiro-validate-design-ex`.
</instructions>

## Safety

- Missing `design-qa.md` with `VERDICT: GO` → stop: run `/kiro-validate-design-qa $1` first.
