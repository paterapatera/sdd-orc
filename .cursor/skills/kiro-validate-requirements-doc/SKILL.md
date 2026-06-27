---
name: kiro-validate-requirements-doc
description: Creates requirements supplementary materials (glossary, context diagram, use-case diagrams) and links ACs to material IDs in requirements.md. Use after /kiro-validate-requirements-sec in AI-DLC flow. No user dialogue.
metadata:
  shared-rules: "../kiro-validate-shared/contract.md, ../kiro-validate-shared/supplements.md"
---

# Validate Requirements (Documentation)

<background_information>
Third requirements-phase validate. Creates supplements and AC cross-references. Does not add ACs outside PO-validated scope.
</background_information>

<instructions>
## Inputs

- Feature: `$1`
- `docs/specs/$1/requirements.md`
- Existing supplements under `docs/specs/_shared/` and `docs/specs/$1/supplements/`

## Execution

1. Read `../kiro-validate-shared/contract.md` if not already loaded this session.
2. Read `../kiro-validate-shared/supplements.md` (supplement placement and IDs).
3. Read `rules/doc-checklist.md` from this skill directory.
4. Create or update supplement files; update「関連する補足資料」column in `requirements.md`.
5. Write `docs/specs/$1/reviews/requirements-doc.md` per contract format.
6. Fresh-evidence check before `VERDICT: GO`.

## Update mode

When `/kiro-orchestrate` runs an update flow (要求更新 — not new creation), scope work to **changed ACs and their supplements only** per `../kiro-validate-shared/contract.md` Update Flows. Create or update supplement files and「関連する補足資料」links only where the diff requires it; leave unrelated supplements and AC references unchanged.

## Constraints

- Do not add new ACs beyond PO-validated scope.
- Do not ask the user questions.

## On NO-GO

Orchestrator may roll back to supplements only or full requirements regeneration per failure scope.
</instructions>

## Safety

- Missing `requirements.md` → stop: complete prior validates first.
- Missing `reviews/requirements-sec.md` with `VERDICT: GO` → stop: run `/kiro-validate-requirements-sec $1` first.
