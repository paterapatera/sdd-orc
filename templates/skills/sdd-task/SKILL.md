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

This example passes `check` with the `/sdd-req` and `/sdd-design` examples. Keep its indentation and labels, and write the text in `__SDD_LANG__`. On `task.md`, `check` verifies only that `Depends on:` cites smaller existing majors and that the `Requirements:` ids match the design's traceability ids exactly. The other rules here are yours to follow. Write `task.md` first, then check. Do not open `__SDD_SCRIPT__` before that check, and afterwards open it only for a report this skill does not explain.

```markdown
# Tasks

- [ ] 1. Issue credit notes (P)
  - 1.1 Add the credit note table and repository
    - Requirements: DATA-CRN-NEW-1
  - 1.2 Issue a credit note and refuse a second one
    - Requirements: REQ-CRN-NEW-1, REQ-CRN-NEW-2
  - 1.3 Unit and integration tests for issuing
    - Requirements: REQ-CRN-NEW-1, REQ-CRN-NEW-2, DATA-CRN-NEW-1
  - 1.4 Write the Staging performance test for issue to display
    - Requirements: NFR-CRN-NEW-1
- [ ] 2. Publish credit notes to accounting
  - Depends on: 1
  - 2.1 Publish the credit note issued event
    - Requirements: IF-CRN-NEW-1
  - 2.2 Write the CI contract test for the event shape
    - Requirements: IF-CRN-NEW-1
- [ ] 3. Show the due date and remove reprinting (P)
  - 3.1 Show the due date on issued invoices, with an integration test
    - Requirements: REQ-INV-1
  - 3.2 Delete the reprint route and its tests
    - Requirements: REQ-INV-2
- [ ] 4. Manual verification
  - Depends on: 2, 3
  - 4.1 Issue a credit note on the screen and check the already credited message on a second try
    - Requirements: REQ-CRN-NEW-1, REQ-CRN-NEW-2
  - 4.2 Open an issued invoice and check the due date
    - Requirements: REQ-INV-1
```

## Verification

| Runs on | Where it is tracked |
|---|---|
| Local | Completion of the major item |
| Human | The final major item, `Manual verification` |
| CI | Pull request section `Post-merge verification` |
| Staging | Pull request section `Post-merge verification` |

Write the CI and Staging test code during implementation, and do not run those suites here. Human checks are only those a person can do before close. A visual check that needs a deployed environment is Staging.

Run `__SDD_RUNTIME__ __SDD_SCRIPT__ check --issue <feature>`, then commit only this issue directory as `docs`.
