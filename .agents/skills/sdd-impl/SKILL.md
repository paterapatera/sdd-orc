---
name: sdd-impl
description: Implement a spec whose ready_for_implementation is true. The parent chooses the next chunk. Do not run implementers in parallel in the same worktree.
disable-model-invocation: true
---

# Implementation

`<feature>` is required. Do not guess it. Stop unless `docs/specs/<feature>/spec.json` has `ready_for_implementation: true`.

The parent reads `tasks.md`. A task is ready when every id in `depends` has `status` `done` and its own `blocked` is null. Dispatch follows `depends`. `wave` is only a sort hint. There is no packing ceiling. Only one implementer runs in a worktree.

Pass the subagent that chunk's tasks, the matching requirements and design excerpts, and the task's `contracts` and `boundary` paths. The implementer builds the shape in `physical` and in each `physical_decisions` entry whose `basis` is `human`. The test checks `done`. Do not pass the full spec. A legacy checkbox file still uses `_Contracts:_` and `_Boundary:_`.

A good change has a failing test first, then production code that passes, without breaking existing tests. A test that fails before the production code is RED.

Before review, the parent checks mechanically:

- The test command runs for this chunk and exits pass or fail
- The diff has no TBD, TODO, or FIXME
- The diff has no secret value
- The diff stays inside the task's `boundary`
- The test that should fail did fail before the production code

Then run `sdd-review` once in a fresh subagent. Do not set `status` to `done` until it approves. A legacy checkbox file still uses `[x]`. After approval, do not check the same evidence again.

When no task is open, run `sdd-validate-impl` once.

`git add` only the paths this chunk touched. Do not use a destructive `git reset`. Send a failed implementation to `sdd-debug` in a context that does not have this conversation. Read status only from `phase`, `approvals`, and `ready_for_implementation` in `spec.json`, and from `tasks[].status` in `tasks.md`. A legacy file uses its checkboxes.
