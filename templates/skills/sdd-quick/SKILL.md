---
name: sdd-quick
description: Plan and implement a small change that does not alter specs, steering, or decisions. Use when the user runs /sdd-quick.
---

# sdd-quick

Docs directory: `__SDD_DOCS_DIR__`. Issue directory: `__SDD_DOCS_DIR__/issues/<current-branch>/`. Do not ask questions. Run setup check first.

Stop before writing anything when any of these is false: `proposal.md` exists, Impact Capabilities, Steering, and Decisions are all `none`, and requirements, research, and design are absent. When `task.md` exists and a major item is unchecked, resume it instead of replanning.

Read the proposal, code, specs, steering, and decisions. Stop with no file changes when the plan would contradict an existing REQ, IF, DATA, or NFR, add visible behavior, change a contract, change persisted data, change a quality target, change steering, or contradict an Accepted ADR or the ADR rules. A new file changes steering when steering lists files, modules, or code-to-specs mappings it would belong to, so keep the work inside existing files when you can. Also stop when the visible behavior is ambiguous, when a major-item plan would exceed three items, or when CI or Staging verification is required.

Allowed work is a defect fix back to specified behavior, an internal defect, a refactor with unchanged behavior, a performance improvement inside the current target, a patch or minor dependency update, a test, or a comment. Write `task.md` in the `/sdd-task` shape: `# Tasks`, checkbox majors with numbered minor items, then `## Assumptions` for internal assumptions. Do not write `Requirements:`. A quick issue has no `design.md`, so `check --issue` does not run task traceability or `Depends on:` rules (those run only when both `task.md` and `design.md` exist). Use `check --stage close --issue <feature>` before close so every major task is checked (`CLOSE_TASKS`). Do not open `__SDD_SCRIPT__` unless a check reports something this skill does not explain.

For `Type: fix`, the first minor item is a regression test that fails before the fix and passes after it. Add Manual verification only when a person must look. Implement majors in order. Retry a failing test twice, then stop. If implementation discovers a stopping condition, leave the edits uncommitted and report the condition, the switch to `/sdd-req` then `/sdd-design` then `/sdd-task`, and a revised Impact.

When the work is done, commit `proposal.md`, `task.md`, and the implementation together with the proposal type. Stage named paths only.

## Issue feedback (`feedback.md`)

Append to `__SDD_DOCS_DIR__/issues/<current-branch>/feedback.md` (create with `# Feedback` if missing). One entry per event: `## YYYY-MM-DD sdd-quick — <kind>` then a short summary. Do not read `knowledge/lessons/`.

Record when:

- You stop mid-implementation because a stopping condition was found: kind `quick-stop`.
- You stop after test retries (two failures on a major): kind `test-stop`.
- The same `check` diagnostic code appears again on this issue: kind `repeat-check` (include the code and count).
