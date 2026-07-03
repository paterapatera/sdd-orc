# Validate Phase Contracts

Per-skill I/O and boundaries. Shared report format: `contract.md`.

## Requirements Phase (serial: po → sec)

| Skill | Input | Output / side effects | Do not |
| ----- | ----- | --------------------- | ------ |
| `/kiro-validate-requirements` | `requirements.md`, `brief.md`, steering | `reviews/requirements-po.md`; fix `requirements.md` if needed; `## Decisions` | EARS mechanical check, security deep-dive, user dialogue |
| `/kiro-validate-requirements-sec` | `requirements.md`, steering security | `reviews/requirements-sec.md`; adopt/defer in `## Decisions` | Functional scope (PO), user dialogue |

> Documentation (glossary, context diagram, acceptance-criteria diagram, functional test cases) is split out of the requirements phase. It is handled post-implementation by `/kiro-docs` (interactive; includes spec cleanup).

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
| `/kiro-validate-design-ex` | 3 specialist reports + final `design.md` | `reviews/design-final.md`; synthesis `## Decisions` | Re-run qa/arch/sec analysis |

Serial required: each specialist writes `design.md` before the next runs.

**Standalone** (not AI-DLC): `/kiro-validate-design` — interactive review; does not replace `validate-design-ex` in orchestrate flows.

### `/kiro-validate-design-ex` input contract (AI-DLC)

1. `reviews/design-{qa,arch,sec}.md` all exist with `VERDICT: GO` — else do not enter final review
2. Synthesize findings; max 3 cross-cutting concerns
3. No specialist deep-dive — rollback to failing specialist validate if gaps found
4. Output: `reviews/design-final.md` per shared contract (`VERDICT`, `## Decisions`)

## Phase Gate Verification

After mechanical validates for a phase, before human approval: `/kiro-verify-phase-gate` with `PHASE_GATE` (not `FEATURE_GO`). Checklist: `phase-gate.md`.
