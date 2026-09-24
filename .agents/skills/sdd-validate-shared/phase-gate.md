# Phase Gate Verification (PHASE_GATE)

Checklist source for the unified validates' inline `## Phase Gate` (requirements / design). The tasks gate is an orchestrator inline check (`sdd-orchestrate/rules/gates.md` § タスクゲート).

## Claim Type Matrix

| Situation | Skill | Claim type |
| --------- | ----- | ---------- |
| 要求 / 設計の統合 validate 内 | `/sdd-validate-requirements` / `/sdd-validate-design-qa`（inline `## Phase Gate`） | `PHASE_GATE` |
| タスク生成後（Terminal auto-approve 前） | 調整者のタスクゲート（`gates.md`） | `PHASE_GATE` |
| `/sdd-impl` バッチ／複数タスク選択の完了ゲート（`[x]` 直前） | `/sdd-verify-completion` | `BATCH` |
| `/sdd-impl` 単一手動タスクの完了ゲート | `/sdd-verify-completion` | `TASK` |
| Path B 直接実装の完了 | `/sdd-verify-completion` | `FIX` or `TEST_OR_BUILD` |
| 全タスク完了 + `/sdd-validate-impl` GO 後 | `/sdd-verify-completion` | `FEATURE_GO` |

**Override**: 要求・設計のフェーズゲートは統合 validate 内の `## Phase Gate` だけを使う。タスクは調整者が inline で確認する。`sdd-orchestrate/rules/gates.md` と `../sdd-validate-shared/contract.md` が正本。

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
| 3 | `reviews/requirements-review.md` → `VERDICT: GO` |
| 4 | `reviews/requirements-review.md` → Phase Gate `STATUS: VERIFIED` |

If `requirements-review.md` is absent (including specs with only old 4-file reports), result is **NOT_VERIFIED** — re-run `/sdd-validate-requirements` to generate the unified report.

Unified `/sdd-validate-requirements` performs these checks **inline** (Pass B step 8) and records results under `## Phase Gate`.

## Phase: `design`

| # | Check |
| - | ----- |
| 1 | `docs/specs/<feature>/design.md` exists |
| 2 | `spec.json` → `approvals.design.generated === true` |
| 3 | `reviews/design-review.md` → `VERDICT: GO` |
| 4 | `reviews/design-review.md` → Phase Gate `STATUS: VERIFIED` |

If `design-review.md` is absent (including specs with only old 4-file reports), result is **NOT_VERIFIED** — re-run `/sdd-validate-design-qa` to generate the unified report.

Unified `/sdd-validate-design-qa` performs these checks **inline** (Pass B step 8) and records results under `## Phase Gate`.

## Verdict Mapping

| Result | Orchestrator action |
| ------ | ------------------- |
| `VERIFIED` | Phase terminal |
| `NOT_VERIFIED` | Fix or rollback |
| `MANUAL_VERIFY_REQUIRED` | Stop; report gaps to user |
