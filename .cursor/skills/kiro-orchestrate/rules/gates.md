# Phase Gates

## Mechanical Gate (per validate/review)

Parse report files only — do not re-run analysis:

| Source | Parse field |
| ------ | ----------- |
| `reviews/*.md` from validate skills | `VERDICT: GO` \| `NO-GO` \| `MANUAL_VERIFY_REQUIRED` |
| `/kiro-review` | `APPROVED` \| `REJECTED` |
| `/kiro-validate-impl` | GO/NO-GO per that skill's output |

Report paths: see `../kiro-validate-shared/contract.md` (read only if parsing).

| Verdict | Orchestrator action |
| ------- | ------------------- |
| `GO` / `APPROVED` | Continue same-phase validates; when all pass → phase gate verification (below) |
| `NO-GO` / `REJECTED` | Rollback per `rollback.md` |
| `MANUAL_VERIFY_REQUIRED` | Stop; report to user until resolved |

## Phase Gate Verification (要求 / 設計 / タスク)

After all mechanical validates for a phase report `GO`, **before** opening the human approval gate:

1. Dispatch `/kiro-verify-phase-gate <feature> <phase>` (`requirements` | `design` | `tasks`)
2. Parse `STATUS: VERIFIED` | `NOT_VERIFIED` | `MANUAL_VERIFY_REQUIRED` (claim type `PHASE_GATE`)
3. Checklist: `../kiro-validate-shared/phase-gate.md`

| Result | Orchestrator action |
| ------ | ------------------- |
| `VERIFIED` | Open human approval gate (`[GATE]`) |
| `NOT_VERIFIED` | Do not open human gate; rollback per `rollback.md` § Phase gate failures |
| `MANUAL_VERIFY_REQUIRED` | Stop; report gaps to user |

**Do not** use `/kiro-verify-completion` with `FEATURE_GO` for 要求 / 設計 / タスク — that claim type is for post-impl feature completion only. Use `TASK` inside `/kiro-impl` per-task loop; use `FEATURE_GO` only after `/kiro-validate-impl` GO at **[GATE] 実装**.

## Phase Gate Table (`spec.json`)

| Phase | Pass condition | After user approval |
| ----- | -------------- | ------------------- |
| 要求 | `requirements.md` + 3 requirement validates GO | `approvals.requirements.approved: true` → `/kiro-spec-design` |
| 設計 | `design.md` + qa/arch/sec GO + `/kiro-validate-design-ex` GO | `approvals.design.approved: true` → `/kiro-spec-tasks` |
| タスク | `tasks.md` generated | `approvals.tasks.approved: true`, `ready_for_implementation: true` → **end orchestration (do not dispatch `/kiro-impl`)** |
| 実装 | (out of orchestration scope) | reached only via an explicit `実装のみ` invocation |

Requirements validates (all GO): `validate-requirements` → `sec`.

## Human Approval Gate

Open only after `/kiro-verify-phase-gate` returns `VERIFIED` (要求 / 設計 / タスク) or `/kiro-verify-completion` returns verified (`FEATURE_GO` at **[GATE] 実装** only). Report:

1. Current phase + completed validates
2. Key artifact paths
3. **決定事項サマリー** — summarize each report's `## Decisions` as: 何を決めたか / なぜ / 承認で固定されること

   Topics to cover when present:

   | Topic | Examples |
   | ----- | -------- |
   | Scope | in/out of scope, implicit assumptions |
   | Requirements validates | PO defaults, resolved ambiguity |
   | Security validates | adopted controls, deferred risks |
   | Supplements | glossary/boundary interpretation |
   | Design | architecture choices, threat-model assumptions (`reviews/design-*.md`) |
   | Tasks | task split, parallel `(P)` markers, integration boundaries — synthesize from `/kiro-spec-tasks` summary and `tasks.md` (no `reviews/*.md` for tasks phase) |

   Detail lives in `reviews/*.md` where present; gate report stays concise.
4. Open issues (if any)
5. Approval request（承認して次へ or 修正指示）

**Rules**

- No next phase without user approval (`-y` only if user explicitly requests fast-track).
- Path B: no `spec.json` gates — user confirmation at end only.
- After approval: set `approvals.<phase>.approved: true`, proceed to next flow step.
- **タスク gate is terminal.** After タスク approval, set `approvals.tasks.approved: true` and `ready_for_implementation: true`, then **end the orchestration**. Do **not** dispatch `/kiro-impl` — even if the user says "承認して次へ". Implementation requires a separate explicit `実装のみ` invocation.

## Impl Phase Monitoring

Delegate to `/kiro-impl`; monitor stop conditions:

- All tasks `[x]` before `/kiro-validate-impl`
- `_Blocked:_` tasks → stop, report user
- Per-task loop: impl → `/kiro-review` → `/kiro-verify-completion` (impl skill owns detail)

## Brownfield Option

要求新規/要求更新 flows: optionally insert `/kiro-validate-gap` before `/kiro-spec-design`. Skip for greenfield.
