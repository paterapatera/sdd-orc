# Phase Gates

## Mechanical Gate (per validate/review)

Parse report files only — do not re-run analysis:

| Source | Parse field |
| ------ | ----------- |
| `reviews/*.md` from validate skills | `VERDICT: GO` \| `NO-GO` \| `MANUAL_VERIFY_REQUIRED` |
| `/kiro-review` | `APPROVED` \| `REJECTED` |
| `/kiro-validate-impl` | GO/NO-GO per that skill's output |

Report paths: see `../kiro-validate-shared/contract.md` (read only if parsing).

**VERDICT source (要求 / 設計):** unified `reviews/requirements-review.md` / `design-review.md` only — parse `VERDICT:` and `## Phase Gate` → `STATUS:`. Specs without the unified file are not GO (re-validate with the unified skill).

| Verdict | Orchestrator action |
| ------- | ------------------- |
| `GO` / `APPROVED` | Continue same-phase validates; when all pass → phase gate verification (below) |
| `NO-GO` / `REJECTED` | Rollback per `rollback.md` |
| `MANUAL_VERIFY_REQUIRED` | Stop; report to user until resolved |

## Phase Gate Verification (要求 / 設計 / タスク)

**要求 (unified):** After `/kiro-validate-requirements` writes `reviews/requirements-review.md` with `VERDICT: GO` and `## Phase Gate` → `STATUS: VERIFIED`, open the human approval gate. Do **not** dispatch `/kiro-verify-phase-gate` for requirements in the orchestrated flow (standalone re-check still allowed).

**設計 (unified):** After `/kiro-validate-design-qa` writes `reviews/design-review.md` with `VERDICT: GO` and `## Phase Gate` → `STATUS: VERIFIED`, open the human approval gate. Do **not** dispatch `/kiro-verify-phase-gate` for design in the orchestrated flow.

**タスク:** After generation, **before** terminal auto-approve:

1. Dispatch `/kiro-verify-phase-gate <feature> tasks`
2. Parse `STATUS: VERIFIED` | `NOT_VERIFIED` | `MANUAL_VERIFY_REQUIRED` (claim type `PHASE_GATE`)
3. Checklist: `../kiro-validate-shared/phase-gate.md`

| Result | Orchestrator action |
| ------ | ------------------- |
| `VERIFIED` | **Terminal auto-approve** (below) — do **not** open a human approval prompt |
| `NOT_VERIFIED` | Do **not** auto-approve; rollback per `rollback.md` § Phase gate failures |
| `MANUAL_VERIFY_REQUIRED` | Stop; report gaps to user |

**Do not** use `/kiro-verify-completion` with `FEATURE_GO` for 要求 / 設計 / タスク — that claim type is for post-impl feature completion only. Use `TASK` inside `/kiro-impl` per-task loop; use `FEATURE_GO` only after `/kiro-validate-impl` GO at **[GATE] 実装**.

## Phase Gate Table (`spec.json`)

| Phase | Pass condition | After readiness |
| ----- | -------------- | ------------------- |
| 要求 | `requirements.md` + `/kiro-validate-requirements` GO + Phase Gate VERIFIED (`requirements-review.md`) | After **user approval**: `approvals.requirements.approved: true` → `/kiro-spec-design` |
| 設計 | `design.md` + `/kiro-validate-design-qa` GO + Phase Gate VERIFIED (`design-review.md`) | After **user approval**: `approvals.design.approved: true` → `/kiro-spec-tasks` |
| タスク | `tasks.md` generated + `/kiro-verify-phase-gate` VERIFIED | After **auto-approve**（人間プロンプトなし）: `approvals.tasks.approved: true`, `ready_for_implementation: true` → **end orchestration (do not dispatch `/kiro-impl`)** |
| 仕様一式 (S) | `requirements`/`design`/`tasks` generated + sanity review (or unified validates GO) | After **auto-approve**（人間プロンプトなし）: all three `approvals.*.approved: true`, `ready_for_implementation: true` → **end orchestration** |
| 実装 | (out of orchestration scope) | After **user approval** — reached only via an explicit `実装のみ` invocation |

Requirements validate: single `/kiro-validate-requirements` (unified). Design validate: single `/kiro-validate-design-qa` (unified). Interactive `/kiro-validate-design` is outside orchestrate.

## Human Approval Gate

Open only for **要求** / **設計** / **実装** — after requirements/design unified Phase Gate `VERIFIED`, or `/kiro-verify-completion` returns verified (`FEATURE_GO` at **[GATE] 実装** only). Do **not** open for タスク or 仕様一式 (those use **Terminal auto-approve** below). Report:

1. Current phase + completed validates
2. Key artifact paths
3. **決定事項サマリー** — summarize each report's `## Decisions` as: 何を決めたか / なぜ / 承認で固定されること

   要求 / 設計 gates: the unified report (`reviews/requirements-review.md` / `reviews/design-review.md`) already contains the 承認ゲートサマリ (検証済み観点 / 自己修復 / 残リスク / 未決事項) — present it as the primary gate content and ask the user to accept the listed residual risks; do not re-summarize the specialist summaries beyond it.

   Topics to cover when present:

   | Topic | Examples |
   | ----- | -------- |
   | Scope | in/out of scope, implicit assumptions |
   | Requirements validates | PO defaults, resolved ambiguity, testability fixes (`reviews/requirements-review.md`) |
   | Security validates | adopted controls, deferred risks |
   | Supplements | glossary/boundary interpretation |
   | Design | architecture choices, threat-model assumptions (`reviews/design-review.md`) |

   Detail lives in `reviews/*.md` where present; gate report stays concise.
4. Open issues (if any)
5. Approval request（承認して次へ or 修正指示）

**Rules**

- No next phase without user approval for **要求 → 設計 → タスク生成** human gates (`-y` only if user explicitly requests fast-track). **Exception:** terminal タスク / 仕様一式 confirmation is always **auto-approve** (below) — never wait for「承認して次へ」.
- Path B: no `spec.json` gates — user confirmation at end only.
- After human approval (要求 / 設計 / 実装): set `approvals.<phase>.approved: true`, proceed to next flow step.
- Terminal タスク / 仕様一式: use **Terminal auto-approve** — never ask「承認して次へ」for these steps.

### Terminal auto-approve (タスク / 仕様一式)

After mechanical readiness (below), the orchestrator **auto-approves** without opening a human approval prompt:

**M/L — after tasks:**
1. `/kiro-spec-tasks` completed; `approvals.tasks.generated === true`
2. `/kiro-verify-phase-gate <feature> tasks` → `STATUS: VERIFIED`
3. **[調整者]** set `approvals.tasks.approved: true`, `ready_for_implementation: true`, `phase: tasks-approved`
4. Emit **PR Summary Output**
5. End orchestration (do **not** dispatch `/kiro-impl`)

**S — after quick-path:**
1. `/kiro-spec-quick --auto --from-orchestrate` succeeded; all three `approvals.*.generated === true`
2. Sanity review (and optional unified validates) GO as required by quick-path contract
3. **[調整者]** set all three `approvals.*.approved: true`, `ready_for_implementation: true`, `phase: tasks-approved`
4. Emit **PR Summary Output**
5. End orchestration (do **not** dispatch `/kiro-impl`)

Do **not** ask「承認して次へ」for these terminal steps. User can still edit `tasks.md` / re-orchestrate later if needed.

### Complexity tier gate counts

| Tier | Human gates | Notes |
| ---- | ----------- | ----- |
| **S** | **0** | quick-path success → Terminal auto-approve (S) + PR Summary |
| **M** | **2**（要求・設計） | タスクは自動 |
| **L** | **2**（要求・設計） | タスクは自動 |
| missing `complexity_tier` | **2** | Treat as L (backward compatible). |

`実装のみ` is unchanged by tier (one **[GATE] 実装** human gate only).

## [AUTO] 仕様一式 (S-tier only)

Terminal auto-approve checklist covering requirements, design, and tasks (no human prompt).

Precondition:

- `spec.json` `approvals.*.generated === true` for all three phases
- Sanity review or unified validate reports `VERDICT: GO`

On auto-approve (**[調整者]**):

- `approvals.requirements.approved: true`
- `approvals.design.approved: true`
- `approvals.tasks.approved: true`
- `ready_for_implementation: true`
- `phase: tasks-approved`

Then: PR Summary Output → orchestration ends. Do **not** dispatch `/kiro-impl`.

## PR Summary Output (タスク生成完了時)

After **terminal auto-approve** (`approvals.tasks.approved: true`, `ready_for_implementation: true`), and **before** ending the orchestration, emit a Pull Request-ready summary so the user can copy & paste it directly into a PR description.

**Format rules**

- Output as a single fenced ` ```markdown ` code block so it copies cleanly into a PR.
- Language follows the spec artifacts (default Japanese).
- Content is synthesized from the phase reports (`reviews/*.md` `## Decisions`), `requirements.md`, `design.md`, and `tasks.md` — do not re-run analysis, only parse existing artifacts.
- Keep it concise; detail stays in the spec files.

**Required content**

1. **概要** — what this spec/feature delivers (scope in a few sentences), spec path `docs/specs/<feature>/`.
2. **決定事項と理由 一覧** — a table of every key decision with its rationale, aggregated across phases:

   | 決定事項 | 理由 |
   | -------- | ---- |
   | <何を決めたか> | <なぜそう決めたか> |

   Aggregate the same topics as the 決定事項サマリー (Scope / Requirements validates / Security validates / Supplements / Design / Tasks). One row per decision.

**Template**

````markdown
```markdown
## 概要

<feature が実現すること / スコープ>
Spec: `docs/specs/<feature>/`

## 決定事項と理由

| 決定事項 | 理由 |
| -------- | ---- |
| … | … |
```
````

## Impl Phase Monitoring

Delegate to `/kiro-impl`; monitor stop conditions:

- All tasks `[x]` before `/kiro-validate-impl`
- `_Blocked:_` tasks → stop, report user
- Per-task loop: impl → `/kiro-review` → `/kiro-verify-completion` (impl skill owns detail)

## Brownfield Option

`/kiro-spec-design` runs inline gap analysis on brownfield only (writes `research.md`). Greenfield skips gap — no separate gap dispatch.
