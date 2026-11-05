---
name: sdd-pr
description: Print pull request title and body after implementation, before close. Use when the user runs /sdd-pr.
---

# sdd-pr

Docs directory: `__SDD_DOCS_DIR__`. Bodies stay in `__SDD_LANG__`. Base branch: `__SDD_BASE_BRANCH__`. Issue directory: `__SDD_DOCS_DIR__/issues/<current-branch>/`.

Run `__SDD_RUNTIME__ __SDD_SCRIPT__ check --scope setup` first. Read-only for permanent specs, decisions, and steering — do **not** edit any file, push, or open a pull request. Open `__SDD_SCRIPT__` only for a report this skill does not explain.

## When to run

Run after implementation while the issue directory still exists. The user opens the pull request from your output, gets review, applies further fixes with `/sdd-fix` on the same branch, then runs `/sdd-close` after approval. If you run **`/sdd-fix`** or merge **`__SDD_BASE_BRANCH__`** during review, run **`/sdd-pr`** again and update the **Function points** section in the pull request body.

## Steps

1. Run `__SDD_RUNTIME__ __SDD_SCRIPT__ sync-base`. It fetches `__SDD_BASE_BRANCH__` from the remote and fast-forwards the local base ref without checking out that branch. Stop on failure (offline fetch, local base ahead/diverged from the remote, or the base branch checked out in any worktree).
2. Run `__SDD_RUNTIME__ __SDD_SCRIPT__ check --issue <feature>`. Stop and report the cause on failure.
3. Read the proposal, requirements, and design for the pull request text. Run `__SDD_RUNTIME__ __SDD_SCRIPT__ fp --issue <feature> --format json` and keep the result for step 4.
4. Print only the pull request title and body, each in its own fenced code block so the user can copy them: the title in a `text` block, then the body in a `markdown` block. Use a longer fence, such as four backticks, when the body itself contains a fence. Title is `【<key>】<proposal title>` when the feature name has a tracker key, otherwise the proposal title. Build the body from the proposal's Why, What Changes, and Out of Scope, rewritten to what the requirements and design settled; drop choices the proposal left open and list the added ADRs by title. Add `Post-merge verification` checkboxes for CI and Staging rows from Testing Strategy. **Function points:** after the main narrative, add a short section in `__SDD_LANG__` from the step 3 `fp` JSON. When `skipped` is true with `reason` `quick_issue`, write one line that function points are **not counted** for quick issues. Otherwise use `summary.total`, `summary.points`, and `summary.itemCounts` for DATA, EI, EO, EQ, IF_CONSUMED, and IF_PROVIDED (ADDED / MODIFIED / REMOVED counts per kind). Add lines for `summary.reqCount`, `summary.processCount`, and when non-zero `summary.processNone` and `summary.processUnknown` (0 FP). If `summary.ifUnset` has any items, add one line for **IF unset** (0 FP). If `summary.itemCounts.NFR` has any items, add one **NFR** line with ADDED / MODIFIED / REMOVED item counts (0 FP). Do not print `Closes #n`, and do not push or open the pull request.

Stop when any major task is unchecked. A docs-only issue skips task completion and Post-merge verification, and stops while Open Questions remain.
