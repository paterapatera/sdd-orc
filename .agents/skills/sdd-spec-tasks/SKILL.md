---
name: sdd-spec-tasks
description: Write tasks.md from design.md.
disable-model-invocation: true
---

# Tasks

The artifact is `docs/specs/<feature>/tasks.md`. The body is one json fence. `tasks` is an array of objects:

- `id`: `1`, `1.1`, or similar. Flat. A parent id is not implied by a child id.
- `status`: `open` until implementation approval, then `done`.
- `title`: the observable change.
- `done`: what a test or a run sees.
- `req`: requirement ids this task satisfies.
- `boundary`: paths or component ids that may change.
- `contracts`: contract paths to read. Empty array when none.
- `depends`: earlier task ids. Empty array when none.
- `wave`: integer sort hint. Foundation, then core, then integration. Dispatch follows `depends`, not `wave`.
- `blocked`: null, or the human decision required before the task can start.

A good task maps to an acceptance criterion and a design boundary. The first check can be written as a test that fails before implementation.

When `details` says the change is a diff, edit only the open tasks that cover the changed design. Do not set a `done` task back to `open` when its design did not change.

Set `approvals.tasks.generated` to true. Set `source_sha256.design_at_tasks` to the SHA256 of `design.md`. Do not set `ready_for_implementation` here.

A bad task copies a design section and has neither a failing test nor a boundary.
