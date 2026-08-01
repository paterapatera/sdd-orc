# Phase Gate Verification (PHASE_GATE)

Read when executing `/kiro-verify-phase-gate` or when the orchestrator needs pre-implementation gate evidence.

## Claim Type Matrix

| Situation | Skill | Claim type |
| --------- | ----- | ---------- |
| 要求 / 設計 / タスクの機械 validate 完了後（人間承認前） | `/kiro-verify-phase-gate` | `PHASE_GATE` |
| `/kiro-impl` 内のタスク完了 | `/kiro-verify-completion` | `TASK` |
| Path B 直接実装の完了 | `/kiro-verify-completion` | `FIX` or `TEST_OR_BUILD` |
| 全タスク完了 + `/kiro-validate-impl` GO 後 | `/kiro-verify-completion` | `FEATURE_GO` |

**Override**: 要求・設計・タスクのフェーズゲートでは常に `/kiro-verify-phase-gate`（`PHASE_GATE`）を使う。`kiro-orchestrate/rules/gates.md` と `../kiro-validate-shared/contract.md` が正本。

`FEATURE_GO` はテストスイート・ランタイム smoke・統合評価が必要なため、実装前フェーズには不適切。

## Fresh Evidence

- Read files from disk in the current turn
- Parse `VERDICT:` line in each required `reviews/*.md`
- Do not infer GO from validate skill chat output alone

## Phase: `requirements`

| # | Check |
| - | ----- |
| 1 | `docs/specs/<feature>/requirements.md` exists and has requirement / AC content |
| 2 | `spec.json` → `approvals.requirements.generated === true` |
| 3 | `reviews/requirements-po.md` → `VERDICT: GO` |
| 4 | `reviews/requirements-qa.md` → `VERDICT: GO` |
| 5 | `reviews/requirements-sec.md` → `VERDICT: GO` |
| 6 | `reviews/requirements-final.md` → `VERDICT: GO` (`/kiro-validate-requirements-ex`) |
| 7 | `approvals.requirements.approved === false` (not yet human-approved; gate is pre-approval) |

## Phase: `design`

| # | Check |
| - | ----- |
| 1 | `docs/specs/<feature>/design.md` exists |
| 2 | `spec.json` → `approvals.design.generated === true` |
| 3 | `reviews/design-qa.md` → `VERDICT: GO` |
| 4 | `reviews/design-arch.md` → `VERDICT: GO` |
| 5 | `reviews/design-sec.md` → `VERDICT: GO` |
| 6 | `reviews/design-final.md` → `VERDICT: GO` (`/kiro-validate-design-ex`) |
| 7 | `approvals.design.approved === false` |

## Phase: `tasks`

| # | Check |
| - | ----- |
| 1 | `docs/specs/<feature>/tasks.md` exists with at least one task entry |
| 2 | `spec.json` → `approvals.tasks.generated === true` |
| 3 | `approvals.tasks.approved === false` |
| 4 | No `_Blocked:_` tasks unless orchestrator is explicitly resuming blocked work |

Tasks phase has no `reviews/*.md` mechanical validates; generation + structure checks suffice.

## Verdict Mapping

| Result | Orchestrator action |
| ------ | ------------------- |
| `VERIFIED` | Proceed to human approval gate (`[GATE]`) |
| `NOT_VERIFIED` | Do not open human gate; fix or rollback |
| `MANUAL_VERIFY_REQUIRED` | Stop; report gaps to user |
