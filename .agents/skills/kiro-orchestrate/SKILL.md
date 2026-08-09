---
name: kiro-orchestrate
description: AI-DLC orchestrator (調整者). Routes spec-driven development flows, enforces phase gates and rollbacks, dispatches role skills without doing their work. Use for end-to-end feature development, spec/requirements/design updates, implementation-only runs, or when the user invokes the AI-DLC workflow.
metadata:
  shared-rules: "rules/routing.md, rules/flows.md, rules/gates.md, rules/rollback.md, rules/complexity-tier.md, rules/greenfield.md"
---

# AI-DLC Orchestrator (調整者)

<background_information>
The orchestrator decides **when, which role, and which skill** to run. It does not write requirements, design, or code itself. Canonical spec: `rules/` in this skill + `../kiro-validate-shared/`.
</background_information>

<instructions>
## Startup

1. Read `rules/routing.md` — determine active flow from `spec.json` state + user override per § Entry Contract (`/kiro-discovery` runs **standalone before** orchestration; discovery is not an orchestration step).
2. After routing, compute complexity tier per `rules/complexity-tier.md`, map tier → path (`flows.md` § Orchestration Paths by Tier), and select S/M/L flow variant (write `complexity_tier` / `complexity_score` / `complexity_rationale` to `spec.json`). Skip for `実装のみ`.
3. Read **only** the matching section in `rules/flows.md` (e.g. `要求新規作成 (S|M|L)`).
4. Load `rules/gates.md` or `rules/rollback.md` when a gate or failure occurs.
5. Load `rules/integration.md` only for requirements init-skip, Path B, impl loop, or skill-boundary questions.
6. Before any gap or codebase gap-style dispatch: read `rules/greenfield.md`. On greenfield, never dispatch a standalone gap step.

Do **not** load all rule files upfront.

## Execution Loop

For each step in the active flow:

`[調整者]` steps in `rules/flows.md` are executed inline by the orchestrator (e.g. `spec.json` updates); all other steps are skill dispatches.

**When `complexity_tier === "S"` and flow is 要求新規作成 (quick-path):**

1. **[調整者]** Upstream dependency guard
2. Dispatch `/kiro-spec-quick <feature> --auto --from-orchestrate`
3. On success → **Terminal auto-approve (S)** per `rules/gates.md` → PR Summary Output → end

Do **NOT** dispatch individual `spec-requirements`, `validate-*`, `spec-design`, `spec-tasks` separately on S tier.

**For M / L (and non-S flows):**

1. **Dispatch** the listed `/kiro-*` skill — do not inline the role's work.
2. **Parse outcome** from report files (`VERDICT:`) or review output (`APPROVED`/`REJECTED`). Report paths: `../kiro-validate-shared/contract.md` (read only when parsing). Require unified `*-review.md` (`VERDICT:` + Phase Gate `STATUS:`); old 4-file-only specs are not GO.
3. **On phase validates all GO** (要求: `requirements-review.md` Phase Gate `VERIFIED`; 設計: same with `design-review.md`) → open human gate only on verified status per `rules/gates.md`. For 要求/設計, do **not** dispatch `/kiro-verify-phase-gate` when the unified report already has `STATUS: VERIFIED`.
4. **On タスク** after generation → `/kiro-verify-phase-gate` → on `VERIFIED`, **Terminal auto-approve** (set `approvals.tasks.approved` + `ready_for_implementation`) → PR Summary → end. Do **not** wait for「承認して次へ」.
5. **On impl phase complete** (`/kiro-validate-impl` GO) → `/kiro-verify-completion` (`FEATURE_GO`) before **[GATE] 実装**.
6. **On NO-GO / REJECTED / NOT_VERIFIED** → `rules/rollback.md` (phase-gate failures: § Phase gate failures). Do **not** auto-approve on `NOT_VERIFIED`.
7. **On user approval** (要求 / 設計 / 実装 only) → `approvals.<phase>.approved: true` in `spec.json`, continue.

## Hard Constraints

- **Orchestration scope ends at task generation.** Generation flows (要求新規作成 / 要求更新 / 設計更新) terminate at **Terminal auto-approve** (M/L: tasks; S: 仕様一式). After mechanical readiness, auto-approve, emit the **PR Summary Output** (`rules/gates.md` § PR Summary Output — 概要 + 決定事項と理由 一覧, copy-paste ready), and end the orchestration — never chain into `/kiro-impl`, `/kiro-validate-impl`, `/kiro-verify-completion` (`FEATURE_GO`), or any implementation step. Implementation runs only via an explicit `実装のみ` invocation.
- No human approval skip for **要求 / 設計 / 実装** unless user explicitly requests `-y` fast-track. Terminal タスク / 仕様一式 is **always** auto-approve (no human prompt).
- **S tier (quick-path):** one dispatch to `/kiro-spec-quick --auto --from-orchestrate`, then **Terminal auto-approve (S)** → PR Summary → end. Do not run L-flow steps individually.
- Requirements validate: single `/kiro-validate-requirements` (unified po→qa→sec→final+phase-gate). Optional `--only po|qa|sec|final`. (M/L only; S uses quick-path sanity review.)
- Design validate: single `/kiro-validate-design-qa` (unified qa→arch→sec→final+phase-gate). Optional `--only qa|arch|sec|final`. Interactive `/kiro-validate-design` is **not** used in orchestrate. (M/L only.)
- Path B: no spec flow, no `/kiro-impl`.
- Path D/E: per-spec flows in dependency order with upstream guard; no `/kiro-spec-batch`. Never S / quick-path.
- Validate steps run without user dialogue; user interaction only at human `[GATE]` points（要求 / 設計 / 実装）.
- **2 consecutive NO-GO** on the same step → stop; seek user re-alignment (`rules/rollback.md`).
- Progress check: `/kiro-spec-status <feature>`.
- Default flow variant follows `complexity_tier` in `spec.json` (`flows.md` § Orchestration Paths by Tier). L only when score ≥ 5, Path D/E, or user override `full`.
- **Greenfield gap ban**: Do not dispatch a standalone gap step. On greenfield (`rules/greenfield.md`), spec-design skips Step 2.0. If an agent attempts a standalone gap on greenfield, stop with NOT_APPLICABLE.

## Role → Skill Map (dispatch only)

| Role | Skills |
| ---- | ------ |
| プロダクトオーナー | spec-requirements (includes init Step 0), validate-requirements (unified); S tier: via `spec-quick --from-orchestrate` |
| セキュリティ管理者 | (requirements/design sec via unified validate-requirements / validate-design-qa) |
| 設計者 | spec-design (includes brownfield gap), validate-design-qa (unified), spec-tasks; S tier: via `spec-quick --from-orchestrate` |
| 品質管理者 | validate-requirements (unified), validate-design-qa (unified design), validate-impl |
| アーキテクト管理者 | (arch via unified validate-design-qa) |
| 実装者 | `/kiro-impl` (or main context for Path B) |
| 調整者 (self) | routing, gates, rollback, `verify-phase-gate` (タスク; 要求/設計は統合スキル内), `verify-completion` (impl / Path B) |

`discovery` is **not dispatched** by the orchestrator — `/kiro-discovery` is an external pre-step run standalone before orchestration (`routing.md` § Entry Contract).
</instructions>

## Safety

- **Upstream dependency guard**: Do **not** start 要求新規作成 / 要求更新 / 設計更新 for a downstream feature while roadmap upstream deps lack task generation (`routing.md` § Upstream Dependency Guard). Check before init/requirements/design dispatch and before each spec in Path D/E.
- **Modification guard**: Do **not** modify a spec whose implementation is incomplete. Before 要求更新 / 設計更新 (or a Path A change to an existing spec), check `spec.json` + `tasks.md` (`routing.md` § Modification Guard). If the spec is implementation-ready (`ready_for_implementation: true` / `approvals.tasks.approved: true`) but has `[ ]` / `_Blocked:_` tasks, stop and prompt the user to complete implementation first (explicit `実装のみ`).
- Missing both `brief.md` and `spec.json` on spec flows → **stop**; instruct the user to run `/kiro-discovery` standalone first (do not auto-run discovery). If `brief.md` exists but `spec.json` does not: S tier → `/kiro-spec-quick --auto --from-orchestrate`; M/L → start 要求新規作成 at `/kiro-spec-requirements` (initializes if needed).
- `approvals.tasks.approved` false on 実装のみ → stop with message.
- `_Blocked:_` in tasks.md → stop; report user before validate-impl.
