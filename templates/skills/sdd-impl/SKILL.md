---
name: sdd-impl
description: Implement the unchecked major tasks for the current SDD issue. Use when the user runs /sdd-impl.
---

# sdd-impl

Docs directory: `__SDD_DOCS_DIR__`. Issue directory: `__SDD_DOCS_DIR__/issues/<current-branch>/`. Stop when `task.md` is missing.

Run `__SDD_RUNTIME__ __SDD_SCRIPT__ check --scope setup` first. Read the issue documents plus the current specs and the issue delta together. Do not edit `__SDD_KNOWLEDGE_DIR__/specs/`, `decision/`, or `steering/`.

## Execution

1. Run unchecked major items in dependency order. Run `(P)` majors in parallel subagents.
2. Implement every minor item. Run Local tests. Check the major item only when its minor items are done and those tests pass.
3. On a test failure, fix and rerun. Stop that major on the third failure, wait for majors already running, and do not start later majors.
4. Stop and report when the design cannot be implemented as written.
5. Prepare Manual verification steps, and leave that major unchecked for the person who performs it. When you also try the steps yourself, report which ones you tried and what you saw, separately from the steps left for the person.
6. Write CI and Staging tests, and do not run them. Put them where the project's CI or a named command runs them, outside the Local run, and report that command. When the project has no such place, say so in the report.

Refer to requirement ids only in test names and comments. Commit the checked work with the proposal Impact type. When the feature name starts with a tracker key, use that key as the commit scope and write the description in `__SDD_LANG__`. Stage the issue directory and the files this implementation changed. Do not use `git add -A` or `git add .`.

Before reporting completion, run `__SDD_RUNTIME__ __SDD_SCRIPT__ check --stage impl --issue <feature>`. It runs `testCommand` from `sdd.config.json` when set, checks that automated test files reference each non-Manual traceability id, and reports unchecked implementation tasks separately from human Manual verification (notes, not failures). Do not check Manual verification majors automatically.

If steering does not match the code and the difference is outside this issue, finish the implementation and recommend `/sdd-steering`.

## Issue feedback (`feedback.md`)

Append to `__SDD_DOCS_DIR__/issues/<current-branch>/feedback.md` (create with `# Feedback` if missing). One entry per event: `## YYYY-MM-DD sdd-impl — <kind>` then a short summary. Do not read `knowledge/lessons/`.

Record when:

- A major stops after the third test failure: kind `test-stop`.
- You stop because the design cannot be implemented as written: kind `design-blocked`.
- Steering does not match the code and you recommend `/sdd-steering`: kind `steering-drift`.
- The same `check` diagnostic code appears again on this issue: kind `repeat-check` (include the code and count).
