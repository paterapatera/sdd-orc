---
name: kiro-validate-requirements
description: Autonomous post-generation requirements review and brush-up by Product Owner. Semantic consistency, ambiguity resolution, requirements.md fixes. Use after /kiro-spec-requirements in AI-DLC requirements phase. No user dialogue.
metadata:
  shared-rules: "../kiro-validate-shared/contract.md"
---

# Validate Requirements (PO)

<background_information>
First of the requirements-phase validates (po → sec). Autonomous; no user dialogue. Judgments go to `reviews/requirements-po.md` `## Decisions` for the approval gate.
</background_information>

<instructions>
## Inputs

- Feature: `$1`
- `docs/specs/$1/requirements.md`
- `docs/specs/$1/brief.md` (if exists)
- Core steering: `docs/steering/product.md`, `tech.md`, `structure.md`

## Execution

1. Read `../kiro-validate-shared/contract.md` (shared contract — once).
2. Read `rules/po-checklist.md` from this skill directory.
3. Review requirements per checklist; fix `requirements.md` when local and safe.
4. Write `docs/specs/$1/reviews/requirements-po.md` per contract format.
5. Before `VERDICT: GO`, verify files exist and edits are consistent (fresh evidence).

## Update mode

When `/kiro-orchestrate` runs an update flow (要求更新 — not new creation), scope work to **changed requirements and ACs only** per `../kiro-validate-shared/contract.md` Update Flows. Review, fix, and record `## Decisions` only for the diff; leave unchanged requirements as-is. Do not regenerate or re-audit unrelated sections.

## Constraints

- Do not run EARS mechanical checks (that is `requirements-review-gate`).
- Do not perform security deep-dive or create supplements.
- Do not ask the user questions.

## On NO-GO

Orchestrator rolls back to `/kiro-spec-requirements`. Report actionable findings.
</instructions>

## Safety

- Missing `requirements.md` → stop: run `/kiro-spec-requirements $1` first.
- Missing `spec.json` → stop: run `/kiro-spec-init $1` first.
