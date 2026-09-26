---
name: sdd-spec-quick
description: For light speed, write design and tasks in one pass from requirements that are already confirmed.
disable-model-invocation: true
---

# Light design and tasks

The requirements already exist. This skill writes `design.md` and `tasks.md` in the shapes defined by `sdd-spec-design` and `sdd-spec-tasks`. It does not rewrite the requirements, write a review, or set `ready_for_implementation`.

A good design traces each acceptance criterion to a responsibility and a failure behavior inside the `## Record` fence and the matching headings. `contracts` lists only the public-surface files, with `mode` `modify` or `reference`. A good task is one json object with `done`, `physical`, `req`, `boundary`, `depends`, and `wave`, and can be written as a test that fails before implementation. `physical` is the shape `design.md` determines, and `physical_decisions` holds a recommendation where it does not, as `sdd-spec-tasks` says.

When the existing design's hash matches the requirements, do not rewrite the design. Write only the missing tasks.

A choice the requirements do not determine is written as a recommendation with alternatives, as `sdd-spec-design` says, including one observation when a criterion names only the screen or joins two with 「または」. A maximum length, a spaces-only rule, a future date, or a confirmation the requirements do not state is not written in the design. Each task's `done` checks a result an EARS line, a Boundary line, or a `basis` `human` decision states, as `sdd-spec-tasks` says. Look at the repository before `depends` and `files`, as `sdd-spec-design` says, and record that look in `Record.current`. A session guard is not a login route. A missing login route the requirements name is a recommendation, as `sdd-spec-design` says. Do not write tasks while that decision is still `recommendation`. A `depends` entry whose `current.constraint` says it is not in the repository is `blocked` on the first task that needs it. Do not look again.

Set `approvals.design.generated` and `approvals.tasks.generated` to true. Set `source_sha256.requirements_at_design` and `source_sha256.design_at_tasks` to the SHA256 of the files just written.

If an `Open question:` remains, write nothing and set `quick_sanity` to `follow_up`. When both files are written, set `quick_sanity` to `passed`.
