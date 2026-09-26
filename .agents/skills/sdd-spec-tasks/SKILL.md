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
- `physical`: the concrete shape this task builds. Write the table or store, each column with its type and whether it is required, each status code and redirect, each sort, and each widget the requirements already name, bound to the field it changes, when `design.md` already determines that shape. A task that adds none of these still names the function and the data it passes. Empty is not allowed.
- `physical_decisions`: `{ "id": "P-<name>", "choose", "rejected", "basis" }`. Empty array when `design.md` determines the whole shape. When it does not, `basis` is `recommendation`, `choose` is the recommended shape, and `rejected` lists the real alternatives separated by ` / `. Do not present that shape as if the design had decided it. The human is asked whether to keep it, switch to an alternative, or defer. When `details.confirm` is set, update only those entries: set `basis` to `human`, and set `choose` to the selected label unless the label is 「このまま（推奨）」.
- `req`: requirement ids this task satisfies.
- `boundary`: paths or component ids that may change.
- `contracts`: contract paths to read. Empty array when none.
- `depends`: earlier task ids. Empty array when none.
- `wave`: integer sort hint. Foundation, then core, then integration. Dispatch follows `depends`, not `wave`.
- `blocked`: null, or the human decision required before the task can start.

A good task maps to an acceptance criterion and a design boundary. The first check can be written as a test that fails before implementation.

`done` checks a result that an EARS line, a Boundary line, or a design decision with `basis` `human` states. A decision that is still `recommendation` is not a `done` result. `physical` states only the shape `design.md` determines. A status code, a redirect, a required column, a date limit, or a sort order that `design.md` does not determine goes in `physical_decisions` as a recommendation. Do not put that open shape into `done` or `physical`, and do not leave it for the implementer to invent. Do not put it in `blocked`. When `Record.current.constraint` says a `depends` entry is not in the repository, the first task that needs it sets `blocked` to that missing dependency. Do not look the repository again, and do not add tasks that build it. A user model, a session guard, or auth configuration is not evidence that a login route exists. When `current.constraint` says the login route or screen is absent, the task stays `blocked` even if `evidence` names a user model or auth config. Any other `current.evidence` path that shows the dependency already exists is not `blocked`. Every `Record.files` path belongs to a task `boundary`, including contract and ADR files. Every requirement heading number appears in some task's `req`. `.agents/skills/sdd-spec/scripts/sdd.py` checks these: gate gap `5` lists `gate.uncovered_files`, gap `6` lists `gate.uncovered_reqs`, and gap `7` lists `gate.missing_physical`. Fix only those when they are set. It also stops when any `blocked` is set. It does not notice a missing dependency whose `blocked` was left null.

When `details` says the change is a diff, edit only the open tasks that cover the changed design. Do not set a `done` task back to `open` when its design did not change.

Set `approvals.tasks.generated` to true. Set `source_sha256.design_at_tasks` to the SHA256 of `design.md`. Do not set `ready_for_implementation` here.

A bad task copies a design section, has neither a failing test nor a boundary, leaves `physical` empty, or writes a shape `design.md` does not determine as if the design had decided it.
