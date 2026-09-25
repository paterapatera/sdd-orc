---
name: sdd-spec-tasks
description: Write tasks.md from design.md.
disable-model-invocation: true
---

# Tasks

The artifact is `docs/specs/<feature>/tasks.md`. Each task is `- [ ] 1. title` or `- [ ] 1.1 title`, small enough for one implementer to take in order in one worktree.

A good task maps to an acceptance criterion and a design boundary. `_Depends:_` is the earlier task number. `_Boundary:_` is the range that may change. `_Contracts:_` lists only the contracts to read. The first check can be written as a test that fails before implementation.

Use `_Blocked:_` only when a human decision is required before the task can start.

When `details` says the change is a diff, edit only the open tasks that cover the changed design. Do not uncheck a completed `[x]` whose design did not change.

Set `approvals.tasks.generated` to true. Set `source_sha256.design_at_tasks` to the SHA256 of `design.md`. Do not set `ready_for_implementation` here.

A bad task copies a design section and has neither a failing test nor a boundary.
