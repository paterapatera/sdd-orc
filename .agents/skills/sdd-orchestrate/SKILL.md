---
name: sdd-orchestrate
description: AI-DLC orchestrator (調整者). Routes spec-driven development flows, enforces phase gates and rollbacks, dispatches role skills without doing their work. Use for end-to-end feature development, spec/requirements/design updates, or when the user invokes the AI-DLC workflow. Target spec is the required first argument. Implementation is `/sdd-impl`, not this skill.
metadata:
  shared-rules: "rules/routing.md, rules/flows.md, rules/gates.md, rules/rollback.md, rules/complexity-tier.md, rules/greenfield.md, ../sdd-grill-shared/orchestrated-mode.md"
disable-model-invocation: true
---

# AI-DLC Orchestrator (調整者)

<background_information>
The orchestrator decides **when, which role, and which skill** to run. It does not write requirements, design, or code itself. Canonical spec: `rules/` in this skill + `../sdd-validate-shared/`.
</background_information>

<instructions>
## Startup

1. Read `rules/routing.md` — resolve target `<feature>` per § Resolve Target Feature (required explicit arg; do not infer from git branch), then determine active flow from `spec.json` state + user override per § Entry Contract (`/sdd-discovery` runs **standalone before** orchestration; discovery is not an orchestration step).
2. After routing, compute complexity tier per `rules/complexity-tier.md` (on 要求新規作成: **after** brief-grill `READY`, per `flows.md` § 要求新規作成 entry — this applies to S candidates too; grill answers may turn S into M), map tier → path (`flows.md` § Orchestration Paths by Tier), and select S/M/L flow variant (write `complexity_tier` / `complexity_score` / `complexity_rationale` to `spec.json`).
3. Read **only** the matching section in `rules/flows.md` (e.g. `要求新規作成 (S|M|L)`).
4. Load `rules/gates.md` or `rules/rollback.md` when a gate or failure occurs.
5. Load `rules/integration.md` only for requirements init-skip, Path B, or skill-boundary questions.
6. Before any gap or codebase gap-style dispatch: read `rules/greenfield.md`. On greenfield, never dispatch a standalone gap step.

Do **not** load all rule files upfront.

## Execution Loop

For each step in the active flow:

`[調整者]` steps in `rules/flows.md` are executed inline by the orchestrator (e.g. `spec.json` updates); all other steps are skill dispatches.

**When `complexity_tier === "S"` and flow is 要求新規作成 (quick-path):**

1. **[調整者]** Upstream dependency guard
2. `/sdd-brief-grill <feature> --from-orchestrate` (runs before the tier is known; `WAITING` → Grill 待ち stop)
3. Tier computed as S from the grilled brief
4. Dispatch `/sdd-spec-quick <feature> --auto --from-orchestrate`
5. On success → **Terminal auto-approve (S)** per `rules/gates.md` → PR Summary Output → end

Do **NOT** dispatch individual `spec-requirements`, `validate-*`, `spec-design`, `spec-tasks` separately on S tier.

**For M / L (and non-S flows):**

1. **Dispatch** the listed `/sdd-*` skill — do not inline the role's work. 要求 runs as the **要求ブロック** (`rules/flows.md` § 要求ブロック): `/sdd-brief-grill --from-orchestrate` → `/sdd-spec-requirements` → `/sdd-validate-requirements` → `/sdd-req-grill --from-orchestrate`, looping until it converges.
2. **Parse outcome** from report files (`VERDICT:`), review output (`APPROVED`/`REJECTED`), or the grill's `GRILL: READY | WAITING | BLOCKED` line + grill file header. Report paths: `../sdd-validate-shared/contract.md` (read only when parsing). Require unified `*-review.md` (`VERDICT:` + Phase Gate `STATUS:`); old 4-file-only specs are not GO.
3. **On phase gates all pass** (要求: `requirements-review.md` Phase Gate `VERIFIED` **and** the 要求ブロック converged; 設計: `design-review.md` Phase Gate `VERIFIED`) → **Phase terminal** per `rules/gates.md`（handoff → stop; do **not** dispatch the next phase）. If the user then sends correction notes in this chat, stay in the phase. A new `/sdd-orchestrate <feature>` is how they proceed. For 要求/設計, do **not** dispatch `/sdd-verify-phase-gate` when the unified report already has `STATUS: VERIFIED`.
4. **On タスク** after generation → `/sdd-verify-phase-gate` → on `VERIFIED`, **Terminal auto-approve** (set `ready_for_implementation: true`) → PR Summary → end.
5. **On NO-GO / REJECTED / NOT_VERIFIED** → `rules/rollback.md` (phase-gate failures: § Phase gate failures). Do **not** auto-approve on `NOT_VERIFIED`.

## Hard Constraints

- **Artifact-only resume**: 前のチャット履歴・口頭の合意・未書き込みの決定を前提にしない。フェーズの入力は `docs/specs/<feature>/` の成果物（および steering の該当ファイル）のみ。チャットにしかない意図が必要なら、生成前に成果物へ書いてから続行する（勝手に補完しない）。新規セッション再開時は handoff と `spec.json` / 成果物だけを信頼する。「前回チャットでユーザーが言っていた」を理由に設計・タスクを進めない。handoff の残リスク要約の根拠は review ファイル側（再発明しない）。
- **Orchestration scope ends at task generation.** Generation flows (要求新規作成 / 要求更新 / 設計更新) terminate at **Terminal auto-approve** (M/L: tasks; S: 仕様一式). After mechanical readiness, auto-approve, emit the **PR Summary Output** (`rules/gates.md` § PR Summary Output — タイトル + 概要 + 決定事項と理由 一覧 + 残リスク + 折りたたみの受け入れ確認リスト, copy-paste ready), and end the orchestration — never chain into `/sdd-impl`, `/sdd-validate-impl`, `/sdd-verify-completion` (`FEATURE_GO`), or any implementation step. Implementation is a separate `/sdd-impl <feature>` invocation.
- **No `go` / `fix` commands.** Mechanical gates (`VERDICT: GO` + Phase Gate `VERIFIED`) end the *orchestrator* dispatch. The human still reviews artifacts: same-chat notes = correct this phase; new chat `/sdd-orchestrate <feature>` = accept and continue. Phase readiness on disk is `approvals.*.generated` and `ready_for_implementation` only.
- **M/L session boundary:** After 要求 or 設計 is mechanically ready, **do not** continue to the next phase in the same conversation. Emit Phase Handoff and stop; the next phase starts only in a new `/sdd-orchestrate <feature>` on the same checkout. This drops requirements-phase tokens before design (and design-phase tokens before tasks). **設計 → タスク** is cut the same way. S quick-path is the exception (one conversation).
- **S tier (quick-path):** brief-grill (as for every 要求新規作成), then one dispatch to `/sdd-spec-quick --auto --from-orchestrate`, then **Terminal auto-approve (S)** → PR Summary → end. Do not run L-flow steps individually.
- Requirements validate: single `/sdd-validate-requirements` (unified po→qa→sec→final+phase-gate). Optional `--only po|qa|sec|final`. (M/L only; S uses quick-path sanity review.)
- **Grills**: brief-grill runs on every 要求新規作成 before tier scoring (S included) and as 要求ブロック step 1 on 要求更新. req-grill runs in the M/L 要求ブロック only. Both run with `--from-orchestrate` (`../sdd-grill-shared/orchestrated-mode.md`). A fresh AI answerer subagent answers items from evidence. Only the items it takes back go to the human, as choices (AskQuestion). Every choice list includes 「持ち帰る」. If the human picks it → `GRILL: WAITING` → **Grill 待ち** stop (`rules/gates.md`). Never ask the human about items the answerer settled.
- Design validate: single `/sdd-validate-design-qa` (unified qa→arch→sec→final+phase-gate). Optional `--only qa|arch|sec|final`. (M/L only.)
- Path B: no spec flow, no `/sdd-impl`.
- Path D/E: per-spec flows in dependency order with upstream guard. Never S / quick-path.
- Validate steps run without user dialogue. Grills talk to the human only through the 持ち帰り choices. After Phase Handoff, accept same-chat correction notes; do not prompt for `go`.
- **2 consecutive NO-GO** on the same step → stop; seek user re-alignment (`rules/rollback.md`).
- Progress check: `/sdd-spec-status <feature>`.
- Default flow variant follows `complexity_tier` in `spec.json` (`flows.md` § Orchestration Paths by Tier). L only when score ≥ 5, Path D/E, or user override `full`.
- **Greenfield gap ban**: Do not dispatch a standalone gap step. On greenfield (`rules/greenfield.md`), spec-design skips Step 2.0. If an agent attempts a standalone gap on greenfield, stop with NOT_APPLICABLE.

## Role → Skill Map (dispatch only)

| Role | Skills |
| ---- | ------ |
| プロダクトオーナー | spec-requirements (includes init Step 0), validate-requirements (unified); S tier: via `spec-quick --from-orchestrate` |
| セキュリティ管理者 | (requirements/design sec via unified validate-requirements / validate-design-qa) |
| 設計者 | spec-design (includes brownfield gap), validate-design-qa (unified), spec-tasks; S tier: via `spec-quick --from-orchestrate` |
| 品質管理者 | validate-requirements (unified), validate-design-qa (unified design) |
| 業務委託担当者 | brief-grill (`--from-orchestrate`, every 要求新規作成 incl. S, and 要求更新), req-grill (`--from-orchestrate`, M/L 要求ブロック only) |
| アーキテクト管理者 | (arch via unified validate-design-qa) |
| 調整者 (self) | routing, gates, rollback, `verify-phase-gate` (タスク; 要求/設計は統合スキル内) |

`discovery` is **not dispatched** by the orchestrator — `/sdd-discovery` is an external pre-step run standalone before orchestration (`routing.md` § Entry Contract). `/sdd-brief-grill` is dispatched at 要求新規作成 entry for every tier (S included) and in the 要求更新 要求ブロック. `/sdd-req-grill` is dispatched only in the M/L 要求ブロック. Both always get `--from-orchestrate`. Both skills set `disable-model-invocation`, so read them by path (`../sdd-brief-grill/SKILL.md`, `../sdd-req-grill/SKILL.md`). Humans can still run them standalone.
</instructions>

## Safety

- **Upstream dependency guard**: Do **not** start 要求新規作成 / 要求更新 / 設計更新 for a downstream feature while roadmap upstream deps lack task generation **in this checkout** (`routing.md` § Upstream Dependency Guard). Check before init/requirements/design dispatch and before each spec in Path D/E. Another worktree is not visible; merge or rebase onto the integration tip that contains upstream `tasks.md`, then retry.
- **Modification guard**: Do **not** modify a spec whose implementation is incomplete. Before 要求更新 / 設計更新 (or a Path A change to an existing spec), check `spec.json` + `tasks.md` (`routing.md` § Modification Guard). If the spec is implementation-ready (`ready_for_implementation: true`) but has `[ ]` / `_Blocked:_` tasks, stop and prompt the user to complete implementation first (`/sdd-impl <feature>`).
- No `<feature>` argument → **stop**; ask for a spec name. Do not resolve from git branch or chat history.
- Missing both `brief.md` and `spec.json` on spec flows → **stop**; instruct the user to run `/sdd-discovery` standalone first (do not auto-run discovery). If `brief.md` exists but `spec.json` does not: start 要求新規作成 at `flows.md` § 要求新規作成 entry (brief-grill → tier). Then S → `/sdd-spec-quick --auto --from-orchestrate`; M/L → 要求ブロック (`/sdd-spec-requirements` initializes if needed).
- `ready_for_implementation: true` with no 要求更新 / 設計更新 override (including「実装のみ」「実装だけ」) → **stop**; instruct `/sdd-impl <feature>`. Orchestration does not implement.
