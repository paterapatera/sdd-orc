---
name: kiro-validate-design-ex
description: Autonomous design-phase final gate for AI-DLC. Synthesizes qa/arch/sec specialist reports into cross-cutting GO/NO-GO. No user dialogue. Use after /kiro-validate-design-sec in /kiro-orchestrate flows. Do not use instead of interactive /kiro-validate-design for standalone review.
metadata:
  shared-rules: "../kiro-validate-shared/contract.md"
---

# Validate Design (AI-DLC Final Gate)

<background_information>
Fourth design-phase step (after qa → arch → sec). **Synthesis only** — reads three specialist reports and final `design.md`. Does not re-run edge-case, architecture, or security analysis. Judgments go to `reviews/design-final.md` `## Decisions` for the approval gate.

For interactive standalone design review, use `/kiro-validate-design` (unchanged).
</background_information>

<instructions>
## Inputs

- Feature: `$1`
- `docs/specs/$1/reviews/design-qa.md` (`VERDICT: GO` required)
- `docs/specs/$1/reviews/design-arch.md` (`VERDICT: GO` required)
- `docs/specs/$1/reviews/design-sec.md` (`VERDICT: GO` required)
- `docs/specs/$1/design.md` (after sec reflection)
- `docs/specs/$1/requirements.md` (traceability only)
- `docs/specs/$1/spec.json`

## Execution

1. Read `../kiro-validate-shared/contract.md` if not already loaded this session.
2. Read `rules/design-synthesis.md` from this skill directory.
3. Verify all three specialist reports exist with `VERDICT: GO` — else stop (do not synthesize).
4. Synthesize cross-cutting concerns (max 3); do not repeat specialist deep-dives.
5. If a specialist domain gap remains, set `VERDICT: NO-GO` and name the rollback target validate in Findings.
6. Write `docs/specs/$1/reviews/design-final.md` per contract format.
7. Fresh-evidence check before `VERDICT: GO`.

## Update mode

When `/kiro-orchestrate` runs an update flow (要求更新 or 設計更新 — not new creation), scope synthesis to **changed design and requirements sections only** per `../kiro-validate-shared/contract.md` Update Flows. Integrate specialist reports for the diff; do not re-audit unchanged domains or regenerate unrelated cross-cutting findings.

## Constraints

- Do not re-run QA edge-case, architecture, or security threat analysis.
- Do not ask the user questions.
- Do not modify `design.md` unless fixing a trivial inconsistency noted across all three reports (prefer NO-GO + rollback instead).

## On NO-GO

Orchestrator rolls back to `/kiro-spec-design`, then re-runs qa → arch → sec → `/kiro-validate-design-ex`.
</instructions>

## Safety

- Missing `design.md` → stop: run `/kiro-spec-design $1` first.
- Missing any specialist report or non-GO verdict → stop: complete qa → arch → sec first.
- Specialist report missing `VERDICT: GO` → stop with rollback target named in output.
