---
name: kiro-docs
description: Post-implementation documentation & spec cleanup. Consolidates a completed spec into shared docs (glossary, context diagram, acceptance-criteria diagram, functional test cases), confirms with the user, deletes the target spec(s), then updates roadmap.md dependencies. Runs only after implementation is complete and the spec has no unprocessed upstream dependencies.
metadata:
  shared-rules: "rules/documents.md, rules/acceptance-diagram.md, rules/feature-testcase.md, rules/roadmap-cleanup.md"
---

# Docs (post-implementation documentation & spec cleanup)

<background_information>
Runs after a spec's implementation is complete. Consolidates the finished spec into project-shared documentation, then deletes the spec and updates `roadmap.md`. This is not a requirements-phase supplement step; it is a one-time post-implementation wrap-up. Unlike the `/kiro-validate-*` skills, this skill **does** talk to the user (it asks for confirmation before deleting).

Generated documents are written in **Japanese** (matching the Japanese glossary/context templates). This skill's own instructions stay in English, but all produced documents — glossary, context diagram, acceptance-criteria diagram, functional test cases — must be in Japanese.
</background_information>

<instructions>
## Inputs

- Target spec: `$1` (multiple specs allowed)
- `docs/specs/$1/requirements.md` — source for the acceptance-criteria diagram
- `docs/specs/$1/design.md` — source for the functional test cases
- `docs/steering/roadmap.md` — dependency gate and update target
- Existing shared documents under `docs/specs/_shared/`

## Execution

1. **Preconditions check** (`rules/roadmap-cleanup.md` § Preconditions)
   - Read `docs/specs/$1/spec.json` and `tasks.md`. Confirm implementation is complete (all tasks `[x]`, no `_Blocked:_`, approved). If incomplete, stop and report that implementation must finish first.
   - Read the dependencies in `roadmap.md`. If the target spec still has **unprocessed upstream dependencies** (dependency specs that still exist under `docs/specs/`), this run is **not allowed** — stop. Report that the upstream specs must be processed with `/kiro-docs` (documented + deleted) first.
2. **Create documents** (overview in `rules/documents.md`; details in the per-document rules)
   - Glossary → `docs/specs/_shared/glossary.md` (project-wide, merge)
   - Context diagram → `docs/specs/_shared/context-diagram.md` (project-wide, merge)
   - Acceptance-criteria diagram → `docs/specs/_shared/requirements/<business>-diagram.md` (`rules/acceptance-diagram.md`)
   - Functional test cases → `docs/specs/_shared/feature-testcase/<domain>/<action>-testcase.md` (`rules/feature-testcase.md`)
   - **Merge** into existing files when present; otherwise create new.
3. **User confirmation**: Present the list of created/updated document paths and ask the user to confirm the content is acceptable. Fix any issues before continuing.
4. **Deletion notice**: **Before** deleting, explicitly tell the user which spec path(s) will be deleted (`rules/roadmap-cleanup.md` § Deletion).
5. **Delete spec(s)**: Only after the user confirms, delete the target spec director(ies).
6. **Update roadmap**: Remove the deleted spec from `roadmap.md` and drop it from other specs' `Dependencies:` (`rules/roadmap-cleanup.md` § Roadmap Update). This clears downstream specs' upstream dependencies so the next `/kiro-docs` run becomes possible.

## Constraints

- If the preconditions (implementation complete, no upstream dependencies) are not met, **do not create any documents or delete anything** — stop.
- Delete a spec **only after explicit user confirmation**. Always announce the deletion targets beforehand.
- Decide new-file vs merge-into-existing per document; never clobber existing content.
- In the acceptance-criteria diagram, use a **hexagon, not a diamond**, for decision nodes (`rules/acceptance-diagram.md`).
</instructions>

## Safety

- `docs/specs/$1/` does not exist → stop: verify the spec name.
- `requirements.md` / `design.md` missing → skip the corresponding document and report it (still create the others).
- Implementation incomplete (`[ ]` / `_Blocked:_` tasks, or not approved) → stop: finish implementation first.
- Unprocessed upstream dependencies remain → stop: process the upstream specs first.
- `roadmap.md` does not exist → the dependency gate may be treated as a single-spec case and proceed, but confirm with the user before deleting/updating.
