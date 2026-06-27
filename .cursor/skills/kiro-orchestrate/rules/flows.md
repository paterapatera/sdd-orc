# Flow Step Sequences

Load **only** the section matching the active flow. Before each `[GATE]` (要求/設計/タスク): `/kiro-verify-phase-gate <feature> <phase>` must return `VERIFIED`. `[GATE]` = human approval per `gates.md`. **[GATE] 実装**: `/kiro-verify-completion` (`FEATURE_GO`) after `/kiro-validate-impl` GO.

`[調整者]` steps are orchestrator-only (not skill dispatches). Orchestrator updates `spec.json` directly.

## 要求新規作成

1. `/kiro-discovery` → Path C/D/E, spec path `docs/specs/<feature>/`
2. `/kiro-spec-init <feature>` (skip if `spec.json` exists, phase ≥ initialized)
3. `/kiro-spec-requirements <feature>`
4. `/kiro-validate-requirements <feature>`
5. `/kiro-validate-requirements-sec <feature>`
6. `/kiro-validate-requirements-doc <feature>`
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
19. **[GATE] タスク**
20. `/kiro-impl <feature>`
21. `/kiro-validate-impl <feature>`
22. `/kiro-verify-completion <feature>` (`FEATURE_GO`)
23. **[GATE] 実装** → end

## 要求更新

1. `/kiro-discovery`
2. **[調整者]** Invalidate approvals in `docs/specs/<feature>/spec.json` **before** generation or validate (downstream re-gate required):
   - `approvals.requirements.approved: false`
   - `approvals.design.approved: false`
   - `approvals.tasks.approved: false`
   - `ready_for_implementation: false`
   - Update `updated_at`
   - Do **not** clear `generated` flags — existing artifacts remain until regenerated in later steps
3. `/kiro-spec-requirements <feature>` (diff only)
4. `/kiro-validate-requirements <feature>` (diff only)
5. `/kiro-validate-requirements-sec <feature>` (diff only)
6. `/kiro-validate-requirements-doc <feature>` (diff only)
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
18. **[GATE] タスク**
19. `/kiro-impl <feature>`
20. `/kiro-validate-impl <feature>`
21. `/kiro-verify-completion <feature>` (`FEATURE_GO`)
22. **[GATE] 実装** → end

## 設計更新

1. `/kiro-discovery`
2. `/kiro-spec-design <feature>`
3. `/kiro-validate-design-qa <feature>` (diff only)
4. `/kiro-validate-design-arch <feature>` (diff only)
5. `/kiro-validate-design-sec <feature>` (diff only)
6. `/kiro-validate-design-ex <feature>`
7. `/kiro-verify-phase-gate <feature> design`
8. **[GATE] 設計**
9. `/kiro-spec-tasks <feature>` (diff only)
10. `/kiro-verify-phase-gate <feature> tasks`
11. **[GATE] タスク**
12. `/kiro-impl <feature>`
13. `/kiro-validate-impl <feature>`
14. `/kiro-verify-completion <feature>` (`FEATURE_GO`)
15. **[GATE] 実装** → end

## 実装のみ

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

For each spec (dependency order): run full applicable flow above. No `/kiro-spec-batch`.
