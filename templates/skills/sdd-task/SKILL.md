---
name: sdd-task
description: Split the current SDD design into implementation tasks. Use when the user runs /sdd-task.
---

# sdd-task

Docs directory: `__SDD_DOCS_DIR__`. Write task text in `__SDD_LANG__`. Issue directory: `__SDD_DOCS_DIR__/issues/<current-branch>/`. Stop when `design.md` is missing. Do not ask questions.

Run `__SDD_RUNTIME__ __SDD_SCRIPT__ check --scope setup` first. Read requirements, design, and steering.

## task.md

Use `# Tasks` and checkbox only the major items. A major item is one vertical slice an agent can finish in one pass, with 2 to 6 minor items, and it can pass its tests alone. Number majors in execution order. Mark independent majors with `(P)`. `Depends on:` may cite only smaller numbers.

Each minor item is implementation or a test at the design's test level, followed by `Requirements: <ids>`. Every traceability id appears on some minor item. A removed id gets a deletion item. Do not add a task for updating permanent docs.

When traceability is `none`, omit `Requirements:` and put "run the full existing test suite" on the last implementation major, before Manual verification.

## Verification

| Runs on | Where it is tracked |
|---|---|
| Local | Completion of the major item |
| Human | The final major item, `Manual verification` |
| CI | Pull request section `Post-merge verification` |
| Staging | Pull request section `Post-merge verification` |

Write the CI and Staging test code during implementation, and do not run those suites here. Human checks are only those a person can do before close. A visual check that needs a deployed environment is Staging.

Run `__SDD_RUNTIME__ __SDD_SCRIPT__ check --issue <feature>`, then commit only this issue directory as `docs`.
