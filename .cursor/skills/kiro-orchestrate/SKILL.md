---
name: kiro-orchestrate
description: AI-DLC orchestrator (調整者). Routes spec-driven development flows, enforces phase gates and rollbacks, dispatches role skills without doing their work. Use for end-to-end feature development, spec/requirements/design updates, implementation-only runs, or when the user invokes the AI-DLC workflow.
metadata:
  shared-rules: "rules/routing.md, rules/flows.md, rules/gates.md, rules/rollback.md"
---

# AI-DLC Orchestrator (調整者)

<background_information>
The orchestrator decides **when, which role, and which skill** to run. It does not write requirements, design, or code itself. Canonical spec: `rules/` in this skill + `../kiro-validate-shared/`.
</background_information>

<instructions>
## Startup

1. Read `rules/routing.md` — determine active flow from discovery Path, `spec.json`, user override.
2. Read **only** the matching section in `rules/flows.md`.
3. Load `rules/gates.md` or `rules/rollback.md` when a gate or failure occurs.
4. Load `rules/integration.md` only for spec-init skip, Path B, impl loop, or skill-boundary questions.

Do **not** load all rule files upfront.

## Execution Loop

For each step in the active flow:

`[調整者]` steps in `rules/flows.md` are executed inline by the orchestrator (e.g. `spec.json` updates); all other steps are skill dispatches.

1. **Dispatch** the listed `/kiro-*` skill — do not inline the role's work.
2. **Parse outcome** from report files (`VERDICT:`) or review output (`APPROVED`/`REJECTED`). Report paths: `../kiro-validate-shared/contract.md` (read only when parsing).
3. **On phase validates all GO** (要求 / 設計 / タスク) → dispatch `/kiro-verify-phase-gate <feature> <phase>`; open human gate only on `STATUS: VERIFIED` per `rules/gates.md`.
4. **On impl phase complete** (`/kiro-validate-impl` GO) → `/kiro-verify-completion` (`FEATURE_GO`) before **[GATE] 実装**.
5. **On NO-GO / REJECTED / NOT_VERIFIED** → `rules/rollback.md` (phase-gate failures: § Phase gate failures).
6. **On user approval** → `approvals.<phase>.approved: true` in `spec.json`, continue.

## Hard Constraints

- **Orchestration scope ends at task generation.** Generation flows (要求新規作成 / 要求更新 / 設計更新) terminate at **[GATE] タスク**. Approving that gate ("承認して次へ") ends the orchestration — never chain into `/kiro-impl`, `/kiro-validate-impl`, `/kiro-verify-completion` (`FEATURE_GO`), or any implementation step. Implementation runs only via an explicit `実装のみ` invocation.
- No human approval skip unless user explicitly requests `-y` fast-track.
- Design validates: serial **qa → arch → sec** only; then `/kiro-validate-design-ex`.
- Path B: no spec flow, no `/kiro-impl`.
- Path D/E: per-spec flows; no `/kiro-spec-batch`.
- Validate steps run without user dialogue; user interaction only at `[GATE]` points.
- **2 consecutive NO-GO** on the same step → stop; seek user re-alignment (`rules/rollback.md`).
- Progress check: `/kiro-spec-status <feature>`.

## Role → Skill Map (dispatch only)

| Role | Skills |
| ---- | ------ |
| プロダクトオーナー | discovery, spec-init, spec-requirements, validate-requirements |
| セキュリティ管理者 | validate-requirements-sec, validate-design-sec |
| 設計者 | validate-gap, spec-design, validate-design-ex, spec-tasks |
| 品質管理者 | validate-design-qa, validate-impl |
| アーキテクト管理者 | validate-design-arch |
| 実装者 | `/kiro-impl` (or main context for Path B) |
| 調整者 (self) | routing, gates, rollback, `verify-phase-gate` (要求/設計/タスク), `verify-completion` (impl / Path B) |
</instructions>

## Safety

- **Modification guard**: Do **not** modify a spec whose implementation is incomplete. Before 要求更新 / 設計更新 (or a Path A change to an existing spec), check `spec.json` + `tasks.md` (`routing.md` § Modification Guard). If the spec is implementation-ready (`ready_for_implementation: true` / `approvals.tasks.approved: true`) but has `[ ]` / `_Blocked:_` tasks, stop and prompt the user to complete implementation first (explicit `実装のみ`).
- Missing `spec.json` on spec flows → run discovery + spec-init first.
- `approvals.tasks.approved` false on 実装のみ → stop with message.
- `_Blocked:_` in tasks.md → stop; report user before validate-impl.
