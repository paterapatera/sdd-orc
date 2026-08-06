---
name: kiro-validate-requirements-ex
description: Autonomous requirements-phase final gate for AI-DLC. Verifies po/qa/sec reflections, audits all gap domains the specialists do not cover (brief traceability, cross-spec consistency, NFR completeness, operability expectations, compliance, template conformance, scope fitness, terminology), self-repairs requirements.md, and issues GO/NO-GO so human review is reduced to residual-risk acceptance. No user dialogue. Use after /kiro-validate-requirements-sec in /kiro-orchestrate flows.
metadata:
  shared-rules: "../kiro-validate-shared/contract.md"
---

# Validate Requirements (AI-DLC Final Gate)

<background_information>
Fourth requirements-phase step (after po → qa → sec). The last automated check before the human requirements gate — its job is to make that gate a residual-risk sign-off, not a requirements re-review. It does **not** re-run semantic, testability, or security analysis; instead it verifies those reviews were reflected into `requirements.md`, audits every requirements-quality domain outside their scopes, and self-repairs fixable findings. Judgments go to `reviews/requirements-final.md` `## Decisions` and the 承認ゲートサマリ for the approval gate.
</background_information>

<instructions>
## Inputs

- Feature: `$1`
- `docs/specs/$1/reviews/requirements-po.md` (`VERDICT: GO` required)
- `docs/specs/$1/reviews/requirements-qa.md` (`VERDICT: GO` required)
- `docs/specs/$1/reviews/requirements-sec.md` (`VERDICT: GO` required)
- `docs/specs/$1/requirements.md` (after sec reflection)
- `docs/specs/$1/brief.md` if present (traceability matrix source)
- `docs/specs/$1/spec.json`
- Core steering: `docs/steering/product.md`, `tech.md`, `structure.md`
- `docs/specs/roadmap.md` if present (cross-spec dependency consistency)
- `docs/settings/templates/specs/requirements.md` (structure conformance)

## Execution

1. Read `../kiro-validate-shared/contract.md` if not already loaded this session.
2. Read `rules/requirements-synthesis.md` from this skill directory.
3. Verify all three specialist reports exist with `VERDICT: GO` — else stop (do not proceed).
4. **Reflection verification** (rules § Step 1): mechanically verify every `## Reflected Fixes` row from the three specialist reports against `requirements.md`; cross-check the three `## Decisions` for contradictions; carry deferred risks forward.
5. **Gap-domain audit** (rules § Step 2): check all 8 domains — brief traceability, cross-spec consistency, NFR completeness, operability expectations, compliance, template conformance, scope fitness, terminology & consistency. Every domain gets an explicit result; no cap on findings.
6. **Self-repair** (rules § Step 4): fix Minor and unambiguous Major findings in `requirements.md` directly; record each repair as a `## Reflected Fixes` row. Findings needing specialist re-analysis or new scope decisions → `VERDICT: NO-GO` with the rollback target named in Findings.
7. Write `docs/specs/$1/reviews/requirements-final.md` per contract format, including the 承認ゲートサマリ and the brief→requirements traceability matrix in Evidence (rules § Step 5).
8. Fresh-evidence check before `VERDICT: GO`: repairs written, edited sections consistent, no specialist-domain content changed.

## Update mode

When `/kiro-orchestrate` runs an update flow (要求更新 — not new creation), scope work to **changed requirements and ACs only** per `../kiro-validate-shared/contract.md` Update Flows: reflection verification, gap domains, traceability rebuild, and self-repair apply to the diff and what it transitively touches. Do not re-audit unchanged domains. The 承認ゲートサマリ still lists all 8 domains, marking unchanged ones as not re-audited.

## Constraints

- Do not re-run PO semantic, QA testability, or security analysis — verify their reflection and audit the gap domains instead.
- Do not ask the user questions.
- `requirements.md` self-repair only within the bounds of rules § Step 4: never modify content in the po/qa/sec specialist domains (functional scope decisions, AC verifiability semantics, auth/PII/trust-boundary expectations) — prefer NO-GO + rollback for those.
- Every gap domain must have an explicit result (pass / finding / N/A with reason); never silently skip one.
- Fixes preserve EARS keyword English (When, If, While, Where, shall) and numeric requirement/AC IDs.

## On NO-GO

Orchestrator rolls back to `/kiro-spec-requirements`, then re-runs po → qa → sec → `/kiro-validate-requirements-ex`. Specialist-domain defects: Findings names the failing validate as the rollback target.
</instructions>

## Safety

- Missing `requirements.md` → stop: run `/kiro-spec-requirements $1` first.
- Missing any specialist report or non-GO verdict → stop: complete po → qa → sec first.
- Specialist report missing `VERDICT: GO` → stop with rollback target named in output.
- Self-repair that would touch a specialist domain → do not edit; `VERDICT: NO-GO` with rollback target instead.
