# Documents to create

After implementation completes, `/kiro-docs` consolidates the target spec's content into **four documents**. Merge into existing files without clobbering; create new when absent.

Write all generated documents in **Japanese** (matching the Japanese glossary/context templates). The example blocks in the per-document rules are shown in Japanese for this reason.

## Role of `_shared` documents

These four documents under `docs/specs/_shared/` are **not required inputs for implementer agents**. They exist for humans, follow-on discovery, manual QA, and terminology alignment — explanation material that remains after a feature's `requirements.md` / `design.md` are deleted.

## Generation scope (four only)

Generate or merge **only** the four documents below. Do **not** add generation, regeneration, or "derive from implementation" steps for `docs/architecture/**`, `docs/contracts/**`, or ADRs — contract sync is assumed complete at design time and via impl-drift updates.

| # | Document | Granularity | Source artifact | Location |
| - | -------- | ----------- | --------------- | -------- |
| 1 | Glossary (用語集) | One per project | terms in requirements.md / design.md | `docs/specs/_shared/glossary.md` |
| 2 | Context diagram (コンテキスト図) | One per project | boundaries / external integrations in requirements.md / design.md | `docs/specs/_shared/context-diagram.md` |
| 3 | Acceptance-criteria diagram (受け入れ条件図) | Per business flow (start to finish) | `requirements.md` acceptance criteria | `docs/specs/_shared/requirements/<business>-diagram.md` |
| 4 | Functional test cases (機能テストのテストケース) | Per action (screen) | `design.md` | `docs/specs/_shared/feature-testcase/<domain>/<action>-testcase.md` |

## 1. Glossary

- Purpose: unify terminology to prevent misunderstanding; give consistent definitions to key terms used in requirements / design.
- Template: `docs/settings/templates/specs/supplements/glossary.md`
- One file per project. If `glossary.md` already exists, **append/merge** terms from the target spec (prefer existing definitions on conflict; add only the delta).
- **Every term MUST include a physical name (物理名)** — an English identifier used at programming time for variable/table/API names. Never leave the「物理名」column blank; if no established name exists, propose a reasonable English one. When merging, backfill missing 物理名 on existing rows.

## 2. Context diagram

- Purpose: show the target system's boundary and its relationships to external actors / systems on one diagram.
- Template: `docs/settings/templates/specs/supplements/context-diagram.md`
- One file per project. If it exists, merge in the external integrations / actors discovered in the target spec.

## 3. Acceptance-criteria diagram

Details in `acceptance-diagram.md`. Key points:

- Express the `requirements.md` acceptance criteria as a flow diagram (Mermaid flowchart).
- Build it at the level of a **whole business flow, start to finish** (not per action).
- Use a **hexagon (`{{ }}`), not a diamond**, for decision nodes.
- Acceptance criteria that read unnaturally in a flow are written as **prose**, not in the diagram.
- Location: `docs/specs/_shared/requirements/<business>-diagram.md` (merge if it exists).

## 4. Functional test cases

Details in `feature-testcase.md`. Key points:

- Manual test cases for a **near-production state that integrates multiple environments**. Unit tests are assumed complete.
- Built **per action (screen)**.
- Source is the target spec's `design.md`.
- Location: `docs/specs/_shared/feature-testcase/<domain>/<action>-testcase.md` (merge if it exists).

## Merge policy (common)

- When a file already exists, read it and use the target spec's information to **fill gaps and resolve contradictions**. Keep existing content from other specs.
- When adding new sections, follow the existing heading structure and ID conventions.
- Use relative paths for reference links (glossary, context diagram, etc.).
