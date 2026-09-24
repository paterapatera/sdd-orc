# Rollback

On `NO-GO` / `REJECTED`, roll back to the **generating step** for the failed check. Report: failure reason, impact scope, re-run steps.

| Failed check | Rollback to | Re-run from |
| ------------ | ----------- | ----------- |
| `/sdd-validate-requirements` (unified) | `/sdd-spec-requirements`; if Findings names `grill` → `/sdd-grill <feature> req` (the finding is an intent / scope decision for the human); if Findings names `po`/`qa`/`sec` → fix `requirements.md` then `--only` that pass or full re-run | Re-evaluate the 要求ブロック entry table (`flows.md`): edits to `requirements.md` re-run the req grill in resume mode, then `/sdd-validate-requirements` |
| `/sdd-validate-design-qa` (unified) | `/sdd-spec-design`; if Findings names `qa`/`arch`/`sec` → fix `design.md` then `--only` that pass or full re-run; if Findings names a requirements defect → `/sdd-spec-requirements` (apply 要求 rollback-depth rule) | `/sdd-validate-design-qa`; requirements cause → `/sdd-validate-requirements` → design chain |

## Phase gate failures (unified inline Phase Gate or タスクゲート)

On `NOT_VERIFIED`, parse Phase Gate `CHECKS` (`../sdd-validate-shared/phase-gate.md`) or the タスクゲート GAPS (`gates.md`). Do **not** auto-approve. On `MANUAL_VERIFY_REQUIRED`, stop and report gaps — rollback only if the user directs a fix path.

| Phase | Gap (checklist item) | Rollback to | Re-run from |
| ----- | -------------------- | ----------- | ----------- |
| `requirements` | missing / empty `requirements.md` | `/sdd-spec-requirements` | `/sdd-validate-requirements` |
| `requirements` | `approvals.requirements.generated !== true` | `/sdd-spec-requirements` | `/sdd-validate-requirements` |
| `requirements` | non-GO / missing `reviews/requirements-review.md` | `/sdd-spec-requirements` or `requirements.md` fix | `/sdd-validate-requirements` |
| `requirements` | Phase Gate not `VERIFIED` | fix gaps named in CHECKS | `/sdd-validate-requirements` |
| `requirements` | `ready_for_implementation === true` while re-gating requirements | **[調整者]** re-apply 要求更新 invalidation (`flows.md`) | re-check Phase Gate |
| `design` | missing `design.md` | `/sdd-spec-design` | `/sdd-validate-design-qa` |
| `design` | `approvals.design.generated !== true` | `/sdd-spec-design` | `/sdd-validate-design-qa` |
| `design` | non-GO / missing `reviews/design-review.md` | `/sdd-spec-design` or `design.md` fix | `/sdd-validate-design-qa` |
| `design` | Phase Gate not `VERIFIED` | fix gaps named in CHECKS | `/sdd-validate-design-qa` |
| `design` | `ready_for_implementation === true` while re-gating design | **[調整者]** set `ready_for_implementation: false` | re-check Phase Gate |
| `tasks` | missing / empty `tasks.md` | `/sdd-spec-tasks` | タスクゲート |
| `tasks` | `approvals.tasks.generated !== true` | `/sdd-spec-tasks` | タスクゲート |
| `tasks` | `ready_for_implementation === true` while re-gating tasks | **[調整者]** set `ready_for_implementation: false` | タスクゲート |
| `tasks` | `_Blocked:_` tasks present | stop — report user | resolve blockers before re-gate |
| `tasks` | `source_sha256.design_at_tasks` missing or ≠ `sha256(design.md)` | `/sdd-spec-tasks` | タスクゲート |

## Generation stops

Generation skills return one result line. A stop is not a NO-GO; the artifact was not written.

| Result | Orchestrator action |
| ------ | ------------------- |
| `DESIGN: RETURN_TO_REQUIREMENTS` | Stop. Report the named requirement IDs and gap. Requirements were accepted at the previous Phase Handoff, so the human decides: 要求更新 (`/sdd-orchestrate <feature> 要求更新`) or a direct `requirements.md` fix, then `/sdd-orchestrate <feature>` |
| `DESIGN: STOPPED` | Stop. Report the file and the owning in-flight spec (or the missing template) |
| `TASKS: RETURN_TO_DESIGN` | Stop. Report the gap. The human decides: 設計更新 or 要求更新 (apply the rollback-depth rule below) |
| `QUICK: FOLLOW_UP` | Stop. Report the finding. Do not auto-approve |

## Grill (要求ブロック)

Grills are not validates: there is no NO-GO to roll back. Their stops are:

| Result | Orchestrator action |
| ------ | ------------------- |
| `GRILL: WAITING` | **Grill 待ち** stop (`gates.md` § Grill 待ち). Resume re-asks the DEFERRED items as choices |
| `GRILL: BLOCKED` (AI or human round cap hit) | Stop. Report the live items from the grill file. The user writes answers into `brief.md` / `requirements.md` or re-aligns scope, then `/sdd-orchestrate <feature>` |

## Rules

- Requirements change affecting design/impl → ask user rollback depth: 要求のみ / 設計まで / タスクまで
- **2 consecutive NO-GO** on same step → stop; seek user re-alignment
- Update flows: do **not** regenerate downstream artifacts unrelated to the change diff
