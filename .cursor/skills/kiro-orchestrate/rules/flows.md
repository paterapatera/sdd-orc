# Flow Step Sequences

**Orchestration scope ends at task generation.** The generation flows (要求新規作成 / 要求更新 / 設計更新) terminate at **[GATE] タスク**. Approving that gate ("承認して次へ") finalizes the tasks, emits the **PR Summary Output** (`gates.md` § PR Summary Output), and **ends the orchestration** — it must **not** dispatch `/kiro-impl` or any implementation step. Implementation is run separately (explicit `実装のみ` invocation only).

**Entry precondition (discovery is not an orchestration step).** `/kiro-discovery-ex` is run **standalone before** orchestration and has already produced `brief.md` (for new specs) / `roadmap.md` (when dependencies exist) and, for existing specs, `spec.json`. Orchestration is invoked with a target `<feature>` (+ optional explicit flow) and selects the active flow per `routing.md` § Entry Contract. If neither `brief.md` nor `spec.json` exists for the target, **stop** and instruct the user to run `/kiro-discovery-ex` first (do not auto-run discovery).

Load **only** the section matching the active flow. Before each `[GATE]` (要求/設計/タスク): `/kiro-verify-phase-gate <feature> <phase>` must return `VERIFIED`. `[GATE]` = human approval per `gates.md`.

`[調整者]` steps are orchestrator-only (not skill dispatches). Orchestrator updates `spec.json` directly.

## 要求新規作成

_Precondition_: `/kiro-discovery-ex` (Path C/D/E) already ran standalone; `brief.md` exists at `docs/specs/<feature>/`.

1. **[調整者] Upstream dependency guard** — verify roadmap upstream deps are task-generation complete (`routing.md` § Upstream Dependency Guard). If not ready, **stop** before init or requirements.
2. `/kiro-spec-init <feature>` (skip if `spec.json` exists, phase ≥ initialized)
3. `/kiro-spec-requirements <feature>`
4. `/kiro-validate-requirements <feature>`
5. `/kiro-validate-requirements-sec <feature>`
6. `/kiro-verify-phase-gate <feature> requirements`
7. **[GATE] 要求**
8. `/kiro-validate-gap <feature>` (brownfield, optional)
9. `/kiro-spec-design <feature>`
10. `/kiro-validate-design-qa <feature>`
11. `/kiro-validate-design-arch <feature>`
12. `/kiro-validate-design-sec <feature>`
13. `/kiro-validate-design-ex <feature>`
14. `/kiro-verify-phase-gate <feature> design`
15. **[GATE] 設計**
16. `/kiro-spec-tasks <feature>`
17. `/kiro-verify-phase-gate <feature> tasks`
18. **[GATE] タスク** → PR Summary Output（`gates.md`）を出力 → end（承認後もオーケストレーションは終了。実装工程には進まない）

## 要求更新

_Precondition_: `/kiro-discovery-ex` already ran standalone and confirmed this is an update to existing spec `<feature>` (`spec.json` exists).

1. **[調整者] Modification guard** — verify the target spec's implementation is complete (`routing.md` § Modification Guard). If it is implementation-ready but not complete (`ready_for_implementation: true` with `[ ]` / `_Blocked:_` tasks), **stop** and prompt the user to finish implementation first (explicit `実装のみ`). Do not proceed to the next step.
2. **[調整者] Upstream dependency guard** — verify roadmap upstream deps are task-generation complete (`routing.md` § Upstream Dependency Guard). If not ready, **stop** before generation or validate.
3. **[調整者]** Invalidate approvals in `docs/specs/<feature>/spec.json` **before** generation or validate (downstream re-gate required):
   - `approvals.requirements.approved: false`
   - `approvals.design.approved: false`
   - `approvals.tasks.approved: false`
   - `ready_for_implementation: false`
   - Update `updated_at`
   - Do **not** clear `generated` flags — existing artifacts remain until regenerated in later steps
4. `/kiro-spec-requirements <feature>` (diff only)
5. `/kiro-validate-requirements <feature>` (diff only)
6. `/kiro-validate-requirements-sec <feature>` (diff only)
7. `/kiro-verify-phase-gate <feature> requirements`
8. **[GATE] 要求**
9. `/kiro-spec-design <feature>` (requirements diff only)
10. `/kiro-validate-design-qa <feature>` (diff only)
11. `/kiro-validate-design-arch <feature>` (diff only)
12. `/kiro-validate-design-sec <feature>` (diff only)
13. `/kiro-validate-design-ex <feature>`
14. `/kiro-verify-phase-gate <feature> design`
15. **[GATE] 設計**
16. `/kiro-spec-tasks <feature>` (diff only)
17. `/kiro-verify-phase-gate <feature> tasks`
18. **[GATE] タスク** → PR Summary Output（`gates.md`）を出力 → end（承認後もオーケストレーションは終了。実装工程には進まない）

## 設計更新

_Precondition_: `/kiro-discovery-ex` already ran standalone and confirmed this is a design-only change to existing spec `<feature>` (`spec.json` exists, requirements approved).

1. **[調整者] Modification guard** — verify the target spec's implementation is complete (`routing.md` § Modification Guard). If it is implementation-ready but not complete, **stop** and prompt the user to finish implementation first (explicit `実装のみ`). Do not proceed.
2. **[調整者] Upstream dependency guard** — verify roadmap upstream deps are task-generation complete (`routing.md` § Upstream Dependency Guard). If not ready, **stop** before generation or validate.
3. `/kiro-spec-design <feature>`
4. `/kiro-validate-design-qa <feature>` (diff only)
5. `/kiro-validate-design-arch <feature>` (diff only)
6. `/kiro-validate-design-sec <feature>` (diff only)
7. `/kiro-validate-design-ex <feature>`
8. `/kiro-verify-phase-gate <feature> design`
9. **[GATE] 設計**
10. `/kiro-spec-tasks <feature>` (diff only)
11. `/kiro-verify-phase-gate <feature> tasks`
12. **[GATE] タスク** → PR Summary Output（`gates.md`）を出力 → end（承認後もオーケストレーションは終了。実装工程には進まない）

## 実装のみ

**Enter only on an explicit user request for implementation** (e.g.「実装だけ」). This flow is never reached automatically from a task-generation flow — the タスク gate does not chain into it.

_Precondition_: `/kiro-discovery-ex` already ran standalone (Path A → impl only); `spec.json` exists.

1. Verify `approvals.tasks.approved: true` — stop if false
2. `/kiro-impl <feature>`
3. `/kiro-validate-impl <feature>`
4. `/kiro-verify-completion <feature>` (`FEATURE_GO`)
5. **[GATE] 実装** → end

## Path B 直接実装

Path B is decided by `/kiro-discovery-ex` **before** orchestration. When discovery-ex returns Path B, the work does **not** enter orchestration at all — it is implemented directly in main context. This section documents that boundary; orchestration itself has no Path B flow to run.

1. Implement in main context (no `/kiro-impl`)
2. `/kiro-verify-completion` (claim `FIX` or `TEST_OR_BUILD`)
3. Report changes; user confirmation → end

**Do not use**: `spec.json` gates, `/kiro-impl`, `/kiro-validate-impl`, mandatory `/kiro-review`.

## Path D/E Multi-Spec

_Precondition_: `/kiro-discovery-ex` already ran standalone and produced `roadmap.md` + `brief.md` for each spec.

For each spec in roadmap dependency order:

1. **[調整者] Upstream dependency guard** for that spec (`routing.md` § Upstream Dependency Guard). If not ready, **stop** — do not start this spec's flow.
2. Run the full applicable flow above (要求新規作成 / 要求更新 / 設計更新 as appropriate). No `/kiro-spec-batch`.
