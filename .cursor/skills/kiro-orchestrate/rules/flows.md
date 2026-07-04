# Flow Step Sequences

**Orchestration scope ends at task generation.** The generation flows (要求新規作成 / 要求更新 / 設計更新) terminate at **[GATE] タスク**. Approving that gate ("承認して次へ") finalizes the tasks and **ends the orchestration** — it must **not** dispatch `/kiro-impl` or any implementation step. Implementation is run separately (explicit `実装のみ` invocation only).

Load **only** the section matching the active flow. Before each `[GATE]` (要求/設計/タスク): `/kiro-verify-phase-gate <feature> <phase>` must return `VERIFIED`. `[GATE]` = human approval per `gates.md`.

`[調整者]` steps are orchestrator-only (not skill dispatches). Orchestrator updates `spec.json` directly.

## 要求新規作成

1. `/kiro-discovery` → Path C/D/E, spec path `docs/specs/<feature>/`
2. **[調整者] Upstream dependency guard** — verify roadmap upstream deps are task-generation complete (`routing.md` § Upstream Dependency Guard). If not ready, **stop** before init or requirements.
3. `/kiro-spec-init <feature>` (skip if `spec.json` exists, phase ≥ initialized)
4. `/kiro-spec-requirements <feature>`
5. `/kiro-validate-requirements <feature>`
6. `/kiro-validate-requirements-sec <feature>`
7. `/kiro-verify-phase-gate <feature> requirements`
8. **[GATE] 要求**
9. `/kiro-validate-gap <feature>` (brownfield, optional)
10. `/kiro-spec-design <feature>`
11. `/kiro-validate-design-qa <feature>`
12. `/kiro-validate-design-arch <feature>`
13. `/kiro-validate-design-sec <feature>`
14. `/kiro-validate-design-ex <feature>`
15. `/kiro-verify-phase-gate <feature> design`
16. **[GATE] 設計**
17. `/kiro-spec-tasks <feature>`
18. `/kiro-verify-phase-gate <feature> tasks`
19. **[GATE] タスク** → end（承認後もオーケストレーションは終了。実装工程には進まない）

## 要求更新

1. `/kiro-discovery`
2. **[調整者] Modification guard** — verify the target spec's implementation is complete (`routing.md` § Modification Guard). If it is implementation-ready but not complete (`ready_for_implementation: true` with `[ ]` / `_Blocked:_` tasks), **stop** and prompt the user to finish implementation first (explicit `実装のみ`). Do not proceed to the next step.
3. **[調整者] Upstream dependency guard** — verify roadmap upstream deps are task-generation complete (`routing.md` § Upstream Dependency Guard). If not ready, **stop** before generation or validate.
4. **[調整者]** Invalidate approvals in `docs/specs/<feature>/spec.json` **before** generation or validate (downstream re-gate required):
   - `approvals.requirements.approved: false`
   - `approvals.design.approved: false`
   - `approvals.tasks.approved: false`
   - `ready_for_implementation: false`
   - Update `updated_at`
   - Do **not** clear `generated` flags — existing artifacts remain until regenerated in later steps
5. `/kiro-spec-requirements <feature>` (diff only)
6. `/kiro-validate-requirements <feature>` (diff only)
7. `/kiro-validate-requirements-sec <feature>` (diff only)
8. `/kiro-verify-phase-gate <feature> requirements`
9. **[GATE] 要求**
10. `/kiro-spec-design <feature>` (requirements diff only)
11. `/kiro-validate-design-qa <feature>` (diff only)
12. `/kiro-validate-design-arch <feature>` (diff only)
13. `/kiro-validate-design-sec <feature>` (diff only)
14. `/kiro-validate-design-ex <feature>`
15. `/kiro-verify-phase-gate <feature> design`
16. **[GATE] 設計**
17. `/kiro-spec-tasks <feature>` (diff only)
18. `/kiro-verify-phase-gate <feature> tasks`
19. **[GATE] タスク** → end（承認後もオーケストレーションは終了。実装工程には進まない）

## 設計更新

1. `/kiro-discovery`
2. **[調整者] Modification guard** — verify the target spec's implementation is complete (`routing.md` § Modification Guard). If it is implementation-ready but not complete, **stop** and prompt the user to finish implementation first (explicit `実装のみ`). Do not proceed.
3. **[調整者] Upstream dependency guard** — verify roadmap upstream deps are task-generation complete (`routing.md` § Upstream Dependency Guard). If not ready, **stop** before generation or validate.
4. `/kiro-spec-design <feature>`
5. `/kiro-validate-design-qa <feature>` (diff only)
6. `/kiro-validate-design-arch <feature>` (diff only)
7. `/kiro-validate-design-sec <feature>` (diff only)
8. `/kiro-validate-design-ex <feature>`
9. `/kiro-verify-phase-gate <feature> design`
10. **[GATE] 設計**
11. `/kiro-spec-tasks <feature>` (diff only)
12. `/kiro-verify-phase-gate <feature> tasks`
13. **[GATE] タスク** → end（承認後もオーケストレーションは終了。実装工程には進まない）

## 実装のみ

**Enter only on an explicit user request for implementation** (e.g.「実装だけ」). This flow is never reached automatically from a task-generation flow — the タスク gate does not chain into it.

1. `/kiro-discovery` (Path A → impl only)
2. Verify `approvals.tasks.approved: true` — stop if false
3. `/kiro-impl <feature>`
4. `/kiro-validate-impl <feature>`
5. `/kiro-verify-completion <feature>` (`FEATURE_GO`)
6. **[GATE] 実装** → end

## Path B 直接実装

1. `/kiro-discovery` — Path B → **do not** enter spec flow
2. Implement in main context (no `/kiro-impl`)
3. `/kiro-verify-completion` (claim `FIX` or `TEST_OR_BUILD`)
4. Report changes; user confirmation → end

**Do not use**: `spec.json` gates, `/kiro-impl`, `/kiro-validate-impl`, mandatory `/kiro-review`.

## Path D/E Multi-Spec

For each spec in roadmap dependency order:

1. **[調整者] Upstream dependency guard** for that spec (`routing.md` § Upstream Dependency Guard). If not ready, **stop** — do not start this spec's flow.
2. Run the full applicable flow above (要求新規作成 / 要求更新 / 設計更新 as appropriate). No `/kiro-spec-batch`.
