# Validate Phase Contracts

Per-skill I/O and boundaries. Shared report format: `contract.md`.

## Requirements Phase (unified: `/kiro-validate-requirements`)

| Skill | Input | Output / side effects | Do not |
| ----- | ----- | --------------------- | ------ |
| `/kiro-validate-requirements` | `requirements.md`, `brief.md`, steering, contract, phase-gate | `reviews/requirements-review.md` (PO+QA+Sec summaries, Gap-Domain Audit, 承認ゲートサマリ, Phase Gate); fix `requirements.md` across Pass A/B | EARS mechanical check; merge checklists; specialist self-repair in Pass B; user dialogue |

Single invocation: Pass A (po→qa→sec) then Pass B (reflection + gap domains + inline phase-gate) then write one report. Optional `--only po|qa|sec|final`.

> Documentation (glossary, context diagram, acceptance-criteria diagram, functional test cases) is split out of the requirements phase. It is handled post-implementation by `/kiro-docs` (interactive; includes spec cleanup).

### Unified Pass B (final + phase-gate)

1. Pass A complete — else do not claim full Phase Gate VERIFIED
2. Verify specialist reflections landed in `requirements.md`; audit gap domains (brief traceability, cross-spec consistency, NFR completeness, operability expectations, compliance, template conformance, scope fitness, terminology & consistency); no cap on findings
3. Self-repair `requirements.md` for Minor / unambiguous Major findings only — no specialist deep-dive; rollback to the failing pass (or `/kiro-spec-requirements` for new scope decisions) if a fix needs re-analysis
4. Output: `reviews/requirements-review.md` (`VERDICT`, Phase Gate `STATUS`, 承認ゲートサマリ)

### vs `requirements-review-gate`

| | review-gate (pre-write) | validate-requirements (post-write, unified) |
| - | ----------------------- | ---------------------------------- |
| Purpose | Draft quality, EARS mechanical fit | Semantic + testability + security + gap audit |
| Form | Internal loop (max 2 passes) | Autonomous; decisions in report |
| User report | None | At approval gate via `## Decisions` / 承認ゲートサマリ |

## Design Phase (unified: `/kiro-validate-design-qa`)

| Skill | Input | Output | Do not |
| ----- | ----- | ------ | ------ |
| `/kiro-validate-design-qa` | `requirements.md`, `design.md`, steering, contract, phase-gate | `reviews/design-review.md` (QA+Arch+Sec summaries, Gap-Domain Audit, 承認ゲートサマリ, Phase Gate); fix `design.md` across Pass A/B | Merge checklists; specialist self-repair in Pass B; user dialogue; replace interactive `/kiro-validate-design` |

Single invocation: Pass A (qa→arch→sec) then Pass B (reflection + gap domains + inline phase-gate) then write one report. Optional `--only qa|arch|sec|final`.

**Standalone** (not AI-DLC): `/kiro-validate-design` — interactive review; does **not** replace unified `validate-design-qa` in orchestrate flows.

### Unified Pass B (final + phase-gate)

1. Pass A complete — else do not claim full Phase Gate VERIFIED
2. Verify specialist reflections landed in `design.md`; audit gap domains (traceability, NFR, observability, operability, testability, compatibility, scope, consistency); no cap on findings
3. Self-repair `design.md` for Minor / unambiguous Major findings only — no specialist deep-dive; rollback to the failing pass if a fix needs specialist re-analysis
4. Output: `reviews/design-review.md` (`VERDICT`, Phase Gate `STATUS`, 承認ゲートサマリ)

## Phase Gate Verification

- **Requirements:** unified skill embeds phase-gate checks in `requirements-review.md` (`## Phase Gate`). Orchestrator does not dispatch `/kiro-verify-phase-gate` when `STATUS: VERIFIED`.
- **Design:** unified `/kiro-validate-design-qa` embeds phase-gate checks in `design-review.md`. Orchestrator does not dispatch `/kiro-verify-phase-gate` when `STATUS: VERIFIED`.
- **Tasks:** after generation, before human approval: `/kiro-verify-phase-gate` with `PHASE_GATE` (not `FEATURE_GO`). Checklist: `phase-gate.md`.
