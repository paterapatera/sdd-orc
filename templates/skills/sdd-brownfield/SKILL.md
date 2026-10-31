---
name: sdd-brownfield
description: Find gaps between existing code and durable specs after SDD is introduced mid-project. Use when the user runs /sdd-brownfield or adopts sdd-orc on a running app.
---

# sdd-brownfield

Docs directory: `__SDD_DOCS_DIR__`. Write bodies in `__SDD_LANG__`. Base branch: `__SDD_BASE_BRANCH__`. Issue directory: optional; when absent, write under `__SDD_DOCS_DIR__/brownfield/` instead.

Run `__SDD_RUNTIME__ __SDD_SCRIPT__ check --scope setup` first. Read `__SDD_KNOWLEDGE_DIR__/steering/structure.md` (Code-to-Specs Mapping), `tech.md`, and every capability under `specs/`. Do not change product behavior in this skill.

## Gap analysis

1. List every `REQ|IF|DATA|NFR-<CODE>-<n>` in durable specs.
2. Search application and test code (skip `__SDD_DOCS_DIR__` and skill directories) for each id in comments, test names, and string literals.
3. List specs ids with no code or test reference (spec without implementation evidence).
4. List code and test references to requirement ids that do not exist in specs (orphan references).
5. Note steering paths or mappings that no longer match the repository layout.

Record the result in `gap.md` with `# Gap analysis`, `## Specs without code evidence`, `## Orphan references in code`, and `## Steering mismatches`. Each bullet ends with `(source: path:line)` or `(source: id)`.

## Review

Before Finish, reread `gap.md` against this list. Fix each gap in the write-up, not in code.

- Every listed spec id appears exactly once under Specs without code evidence or is cited from code.
- Every orphan reference includes a path or test name.
- Steering mismatches name the steering file and what differs.
- No item assumes a person already verified UI or production; those stay for `/sdd-task` Manual verification later.

## Finish

Run `__SDD_RUNTIME__ __SDD_SCRIPT__ check` on the tree. When steering edits made indexes stale, run `__SDD_RUNTIME__ __SDD_SCRIPT__ index` (check also refreshes indexes automatically).

Propose the next step in chat only: `/sdd-reverse` or `/sdd-req` per gap, or `/sdd-steering` for mapping fixes. Do not commit unless the user asks. Human sign-off and `manual ok` on tasks remain unchanged from `/sdd-impl` and `/sdd-close`.
