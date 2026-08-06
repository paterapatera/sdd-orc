# Validate Phase Contracts

Per-skill I/O and boundaries. Shared report format: `contract.md`.

## Requirements Phase (serial: po → qa → sec → validate-requirements-ex)

| Skill | Input | Output / side effects | Do not |
| ----- | ----- | --------------------- | ------ |
| `/kiro-validate-requirements` | `requirements.md`, `brief.md`, steering | `reviews/requirements-po.md`; fix `requirements.md` if needed; `## Decisions` | EARS mechanical check, testability deep-dive, security deep-dive, user dialogue |
| `/kiro-validate-requirements-qa` | **po-updated** `requirements.md`, po report | `reviews/requirements-qa.md`; reflect testability fixes to `requirements.md` | Functional scope (PO), security, EARS mechanical check, user dialogue |
| `/kiro-validate-requirements-sec` | **qa-updated** `requirements.md`, steering security | `reviews/requirements-sec.md`; adopt/defer in `## Decisions` | Functional scope (PO), testability (QA), user dialogue |
| `/kiro-validate-requirements-ex` | 3 specialist reports + final `requirements.md`, `brief.md`, steering, roadmap | `reviews/requirements-final.md` (承認ゲートサマリ + brief traceability matrix); gap-domain self-repairs to `requirements.md`; `## Decisions` | Re-run po/qa/sec analysis; edit specialist-domain content |

Serial required: each specialist writes `requirements.md` before the next runs.

> Documentation (glossary, context diagram, acceptance-criteria diagram, functional test cases) is split out of the requirements phase. It is handled post-implementation by `/kiro-docs` (interactive; includes spec cleanup).

### `/kiro-validate-requirements-ex` input contract (AI-DLC)

1. `reviews/requirements-{po,qa,sec}.md` all exist with `VERDICT: GO` — else do not enter final review
2. Verify specialist reflections landed in `requirements.md`; audit gap domains (brief traceability, cross-spec consistency, NFR completeness, operability expectations, compliance, template conformance, scope fitness, terminology & consistency); no cap on findings
3. Self-repair `requirements.md` for Minor / unambiguous Major findings only — no specialist deep-dive; rollback to the failing specialist validate (or `/kiro-spec-requirements` for new scope decisions) if a fix needs re-analysis
4. Output: `reviews/requirements-final.md` per shared contract (`VERDICT`, `## Decisions`, 承認ゲートサマリ)

### vs `requirements-review-gate`

| | review-gate (pre-write) | validate-requirements (post-write) |
| - | ----------------------- | ---------------------------------- |
| Purpose | Draft quality, EARS mechanical fit | Semantic consistency, ambiguity resolution |
| Form | Internal loop (max 2 passes) | Autonomous; decisions in report |
| User report | None | At approval gate via `## Decisions` |

## Design Phase (serial: qa → arch → sec → validate-design-ex)

| Skill | Input | Output | Do not |
| ----- | ----- | ------ | ------ |
| `/kiro-validate-design-qa` | `requirements.md`, `design.md` | `reviews/design-qa.md`; reflect to `design.md` | Architecture, threat model |
| `/kiro-validate-design-arch` | **qa-updated** `requirements.md`, `design.md`, steering | `reviews/design-arch.md`; reflect to `design.md` | Security, test coverage |
| `/kiro-validate-design-sec` | **arch-updated** `requirements.md`, `design.md` | `reviews/design-sec.md`; reflect to `design.md` | Architecture, QA checklist |
| `/kiro-validate-design-ex` | 3 specialist reports + final `design.md`, `requirements.md`, steering, roadmap | `reviews/design-final.md` (承認ゲートサマリ + traceability matrix); gap-domain self-repairs to `design.md`; `## Decisions` | Re-run qa/arch/sec analysis; edit specialist-domain content |

Serial required: each specialist writes `design.md` before the next runs.

**Standalone** (not AI-DLC): `/kiro-validate-design` — interactive review; does not replace `validate-design-ex` in orchestrate flows.

### `/kiro-validate-design-ex` input contract (AI-DLC)

1. `reviews/design-{qa,arch,sec}.md` all exist with `VERDICT: GO` — else do not enter final review
2. Verify specialist reflections landed in `design.md`; audit gap domains (traceability, NFR, observability, operability, testability, compatibility, scope, consistency); no cap on findings
3. Self-repair `design.md` for Minor / unambiguous Major findings only — no specialist deep-dive; rollback to the failing specialist validate if a fix needs specialist re-analysis
4. Output: `reviews/design-final.md` per shared contract (`VERDICT`, `## Decisions`, 承認ゲートサマリ)

## Phase Gate Verification

After mechanical validates for a phase, before human approval: `/kiro-verify-phase-gate` with `PHASE_GATE` (not `FEATURE_GO`). Checklist: `phase-gate.md`.
