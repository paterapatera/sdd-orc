---
name: sdd-fix
description: Apply a review comment, defect, or requirement change before close. Use when the user runs /sdd-fix.
---

# sdd-fix

Docs directory: `__SDD_DOCS_DIR__`. Issue directory: `__SDD_DOCS_DIR__/issues/<current-branch>/`. Stop when `task.md` is missing. Run setup check first. Execute only the `Fix:` majors you add. Leave other unchecked majors for `/sdd-impl`.

## Level

Judge by whether the expected behavior is already written.

| Level | Meaning | Documents | Confirmation |
|---|---|---|---|
| L0 | Implementation disagrees with correct documents | `task.md` only | none |
| L1 | Requirements are right and the design is wrong | research when needed, design, task | required |
| L2 | Requirements are wrong | requirements, research when needed, design, task | required |
| L3 | What Changes, Out of Scope, or Impact changes | proposal through task | required |

For L1 and above, show one plan covering the level, each document, and the reason. The user accepts, edits, or cancels that whole plan once. Then edit from upstream to downstream using the same rules as the skill that created each document. A new interface or data change raises the level to requirements. Ask at most 5 questions at a time. Delete rewritten `base:` lines, then stamp and check.

Do not uncheck finished majors. Put the changed ids, including MODIFIED and REMOVED, on the new `Fix:` minor items. Append `- [ ] N. Fix: ...`, implement it, and check it when tests pass. Retry a failing test twice, then stop.

For an issue created by `/sdd-quick`, L0 can be fixed in place. L1 and above stop and propose `/sdd-req`, `/sdd-design`, and `/sdd-task`.

Commit L0 once with the proposal type. For L1 and above, commit the documents as `docs`, then commit the implementation with the proposal type. Stage named files only.
