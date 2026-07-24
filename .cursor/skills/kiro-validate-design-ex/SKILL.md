---
name: kiro-validate-design-ex
description: Autonomous design-phase final gate for AI-DLC. Verifies qa/arch/sec reflections, audits all gap domains the specialists do not cover (traceability, NFR, observability, operability, testability, compatibility, scope, consistency), self-repairs design.md, and issues GO/NO-GO so human review is reduced to residual-risk acceptance. No user dialogue. Use after /kiro-validate-design-sec in /kiro-orchestrate flows. Do not use instead of interactive /kiro-validate-design for standalone review.
metadata:
  shared-rules: "../kiro-validate-shared/contract.md"
---

# Validate Design (AI-DLC Final Gate)

<background_information>
Fourth design-phase step (after qa → arch → sec). The last automated check before the human design gate — its job is to make that gate a residual-risk sign-off, not a design re-review. It does **not** re-run edge-case, architecture, or security analysis; instead it verifies those reviews were reflected into `design.md`, audits every design-quality domain outside their scopes, and self-repairs fixable findings. Judgments go to `reviews/design-final.md` `## Decisions` and the 承認ゲートサマリ for the approval gate.

For interactive standalone design review, use `/kiro-validate-design` (unchanged).
</background_information>

<instructions>
## Inputs

- Feature: `$1`
- `docs/specs/$1/reviews/design-qa.md` (`VERDICT: GO` required)
- `docs/specs/$1/reviews/design-arch.md` (`VERDICT: GO` required)
- `docs/specs/$1/reviews/design-sec.md` (`VERDICT: GO` required)
- `docs/specs/$1/design.md` (after sec reflection)
- `docs/specs/$1/requirements.md` (full traceability matrix source)
- `docs/specs/$1/spec.json`
- Core steering: `docs/steering/tech.md`, `structure.md` (consistency checks)
- `docs/specs/roadmap.md` if present (cross-spec dependency consistency)

## Execution

1. Read `../kiro-validate-shared/contract.md` if not already loaded this session.
2. Read `rules/design-synthesis.md` from this skill directory.
3. Verify all three specialist reports exist with `VERDICT: GO` — else stop (do not proceed).
4. **Reflection verification** (rules § Step 1): mechanically verify every `## Reflected Fixes` row from the three specialist reports against `design.md`; cross-check the three `## Decisions` for contradictions; carry deferred risks forward.
5. **Gap-domain audit** (rules § Step 2): check all 8 domains — traceability matrix, NFR, observability, operability, testability, compatibility, scope fitness, consistency. NFR/observability/operability are **verified against the template-required sections**, not authored here. Every domain gets an explicit result; no cap on findings.
6. **Self-repair** (rules § Step 4): fix Minor and unambiguous Major findings in `design.md` directly; record each repair as a `## Reflected Fixes` row. Wholly missing template-required sections or findings needing specialist re-analysis / requirements changes → `VERDICT: NO-GO` with the rollback target named in Findings.
7. Write `docs/specs/$1/reviews/design-final.md` per contract format, including the 承認ゲートサマリ and the full traceability matrix in Evidence (rules § Step 5).
8. Fresh-evidence check before `VERDICT: GO`: repairs written, edited sections consistent, no specialist-domain content changed.

## Update mode

When `/kiro-orchestrate` runs an update flow (要求更新 or 設計更新 — not new creation), scope work to **changed design and requirements sections only** per `../kiro-validate-shared/contract.md` Update Flows: reflection verification, gap domains, traceability rebuild, and self-repair apply to the diff and what it transitively touches. Do not re-audit unchanged domains. The 承認ゲートサマリ still lists all 8 domains, marking unchanged ones as not re-audited.

## Constraints

- Do not re-run QA edge-case, architecture, or security threat analysis — verify their reflection and audit the gap domains instead.
- Do not ask the user questions.
- `design.md` self-repair only within the bounds of rules § Step 4: never modify content in the qa/arch/sec specialist domains (edge-case semantics, component boundaries, trust boundaries/PII/auth) — prefer NO-GO + rollback for those.
- Every gap domain must have an explicit result (pass / finding / N/A with reason); never silently skip one.

## On NO-GO

Orchestrator rolls back to `/kiro-spec-design`, then re-runs qa → arch → sec → `/kiro-validate-design-ex`. Requirements-level defects: Findings names the requirements phase as the rollback target.
</instructions>

## Safety

- Missing `design.md` → stop: run `/kiro-spec-design $1` first.
- Missing any specialist report or non-GO verdict → stop: complete qa → arch → sec first.
- Specialist report missing `VERDICT: GO` → stop with rollback target named in output.
- Self-repair that would touch a specialist domain → do not edit; `VERDICT: NO-GO` with rollback target instead.
