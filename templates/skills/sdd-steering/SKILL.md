---
name: sdd-steering
description: Create or resynchronize steering documents from the code. Use when the user runs /sdd-steering.
---

# sdd-steering

Docs directory: `__SDD_DOCS_DIR__`. Write bodies in `__SDD_LANG__`. Base branch: `__SDD_BASE_BRANCH__`.

Run `__SDD_RUNTIME__ __SDD_SCRIPT__ check --scope setup` first. Continue when the only failure is `SETUP_STEERING_MISSING`. Stop on every other setup failure. Do not create an issue directory and do not create a branch. Stop when `__SDD_DOCS_DIR__/issues/<current-branch>/` exists.

If `steering/` is missing, create it. If it exists, resynchronize it. When a required file is missing during resync, create that file. There is no mode flag.

## Required files and headings

`example.md` next to this file shows all five required files in a form that passes `check`. Copy its frontmatter, heading order, glossary term level, and link form, and read `__SDD_SCRIPT__` only when `check` reports something this skill and the example do not explain.

Keep this order:

- `product.md`: Purpose, Stakeholders and Users, Capabilities Overview, External Systems, Operational Scenarios, Constraints, Related
- `glossary.md`: Terms, Related
- `architecture.md`: Overview, Quality Priorities, Context View, Component View, Runtime View, Deployment View, Cross-cutting Concerns, Related
- `tech.md`: Stack, Development Environment, Common Commands, Coding Conventions, Testing Approach, Related
- `structure.md`: Repository Layout, Module Boundaries, Naming Conventions, Dependency Rules, Code-to-Specs Mapping, Related
- `<topic>.md`: Purpose, Rules, Related

Frontmatter is `type: Steering`, `title`, `description`, and lowercase kebab-case `tags`. Write in the present tense. Do not copy requirements, feature names, or secrets. Keep each file near 300 lines. Capabilities Overview links to domains, not capabilities. Put cross-cutting quality targets in `specs/`, not in steering. Sort glossary terms by Unicode code point, case-insensitive for letters.

## Resync

Compare steering with the code: manifests and commands for `tech.md`, directories and imports for `structure.md`, module dependencies and deploy config for `architecture.md`, and matching code for topic files. Report `product.md` and `glossary.md` differences without editing them. Present each difference as current text, code fact, and proposed text. The user accepts, rejects, or defers one item at a time. Apply only accepted items.

When durable specs already exist under `__SDD_KNOWLEDGE_DIR__/specs/`, also cross-check requirement ids with the code: list every `REQ|IF|DATA|NFR-<CODE>-<n>` in those specs, search application and test code (skip `__SDD_DOCS_DIR__` and skill directories) for each id in comments, test names, and string literals, and report ids with no such reference and references to ids that are not in specs. Use the same resync report shape (current text, code fact, proposed text) or a short chat summary when no steering edit follows; do not add a separate gap file or new durable document. When the user is ready to record missing specs or fix orphan references, recommend `/sdd-init` and then `/sdd-reverse` or `/sdd-req` per item, following init’s next-skill rules.

If code contradicts an Accepted ADR, report `ADR-<n>` and do not edit steering. Report an ADR candidate without creating an ADR. Append accepted edits to `steering/log.md` as `* **Resync**: ...` with no issue name. Do not record rejections.

After either mode, run `__SDD_RUNTIME__ __SDD_SCRIPT__ index` and `__SDD_RUNTIME__ __SDD_SCRIPT__ check`.

## Other skills

When another skill notices an unrelated steering drift, it finishes its work and then recommends `/sdd-steering`.
