# Rollback

On `NO-GO` / `REJECTED`, roll back to the **generating step** for the failed check. Report: failure reason, impact scope, re-run steps.

| Failed check | Rollback to | Re-run from |
| ------------ | ----------- | ----------- |
| `/kiro-validate-requirements` | `/kiro-spec-requirements` | `validate-requirements` |
| `/kiro-validate-requirements-sec` | `/kiro-spec-requirements` or `requirements.md` | po → sec → doc |
| `/kiro-validate-requirements-doc` | supplements only, or `requirements.md` | doc only, or `spec-requirements` → full validate chain |
| `/kiro-validate-design-qa` | `/kiro-spec-design` | qa → arch → sec → `validate-design-ex` |
| `/kiro-validate-design-arch` | `/kiro-spec-design` | same |
| `/kiro-validate-design-sec` | `/kiro-spec-design` | same |
| `/kiro-validate-design-ex` | `/kiro-spec-design` | same |
| `/kiro-impl` task review | that task's implementation | `/kiro-review` |
| `/kiro-validate-impl` | causing task or design | task → `/kiro-impl`; design cause → `/kiro-spec-design` onward |

## Phase gate failures (`/kiro-verify-phase-gate`)

On `NOT_VERIFIED`, parse `GAPS` from verify output against `../kiro-validate-shared/phase-gate.md`. Do **not** open the human approval gate. On `MANUAL_VERIFY_REQUIRED`, stop and report gaps — rollback only if the user directs a fix path.

| Phase | Gap (checklist item) | Rollback to | Re-run from |
| ----- | -------------------- | ----------- | ----------- |
| `requirements` | missing / empty `requirements.md` | `/kiro-spec-requirements` | validate chain: `validate-requirements` → sec → doc |
| `requirements` | `approvals.requirements.generated !== true` | `/kiro-spec-requirements` | same validate chain |
| `requirements` | non-GO or missing `reviews/requirements-po.md` | `/kiro-spec-requirements` or `requirements.md` fix | `validate-requirements` → sec → doc |
| `requirements` | non-GO or missing `reviews/requirements-sec.md` | `/kiro-spec-requirements` or `requirements.md` | po → sec → doc |
| `requirements` | non-GO or missing `reviews/requirements-doc.md` | supplements only, or `requirements.md` | doc only, or `spec-requirements` → full validate chain |
| `requirements` | `approvals.requirements.approved === true` | **[調整者]** re-apply 要求更新 approval invalidation (`flows.md` step 2) | `/kiro-verify-phase-gate` |
| `requirements` | AC supplement ID inconsistency (optional check) | `/kiro-validate-requirements-doc` | doc → `/kiro-verify-phase-gate` |
| `design` | missing `design.md` | `/kiro-spec-design` | qa → arch → sec → `validate-design-ex` |
| `design` | `approvals.design.generated !== true` | `/kiro-spec-design` | same design validate chain |
| `design` | non-GO or missing `reviews/design-qa.md` | `/kiro-spec-design` | qa → arch → sec → `validate-design-ex` |
| `design` | non-GO or missing `reviews/design-arch.md` | `/kiro-spec-design` | arch → sec → `validate-design-ex` |
| `design` | non-GO or missing `reviews/design-sec.md` | `/kiro-spec-design` | sec → `validate-design-ex` |
| `design` | non-GO or missing `reviews/design-final.md` | `/kiro-spec-design` | full design validate chain |
| `design` | `approvals.design.approved === true` | **[調整者]** set `approvals.design.approved: false` (and `approvals.tasks.approved: false`, `ready_for_implementation: false` if tasks were approved) | `/kiro-verify-phase-gate` |
| `tasks` | missing / empty `tasks.md` | `/kiro-spec-tasks` | `/kiro-verify-phase-gate` |
| `tasks` | `approvals.tasks.generated !== true` | `/kiro-spec-tasks` | `/kiro-verify-phase-gate` |
| `tasks` | `approvals.tasks.approved === true` | **[調整者]** set `approvals.tasks.approved: false`, `ready_for_implementation: false` | `/kiro-verify-phase-gate` |
| `tasks` | `_Blocked:_` tasks present | stop — report user | resolve blockers before re-gate |

## Rules

- Requirements change affecting design/impl → ask user rollback depth: 要求のみ / 設計まで / タスクまで
- **2 consecutive NO-GO** on same step → stop; seek user re-alignment
- Update flows: do **not** regenerate downstream artifacts unrelated to the change diff
