# Requirements Supplement Materials

Legacy reference for EARS requirements supplement materials (glossary, context diagram) and AC link format. Post-implementation documentation is handled by `/kiro-docs`.

## Purpose

Support EARS `requirements.md` with reference materials. Link each AC to supplements via **relative-path Markdown links** in the「関連する補足資料」column.

## Placement

| Material | Scope | Path example |
| -------- | ----- | ------------ |
| Glossary / data dictionary | Project-wide | `docs/specs/_shared/glossary.md` |
| Context diagram | Project-wide | `docs/specs/_shared/context-diagram.md` |
| Other supplements | As needed | `docs/specs/<domain>/supplements/` |

## Templates

Copy from `docs/settings/templates/specs/supplements/` when creating priority supplements (extend existing project-wide files in place when they already exist):

| Material | Template |
| -------- | -------- |
| Glossary | `glossary.md` |
| Context diagram | `context-diagram.md` |

Only `glossary.md` and `context-diagram.md` remain as templates; they are consumed post-implementation by `/kiro-docs`. Other supplement types (use-case diagram, state transition, error-handling matrix, etc.) no longer ship templates — author them manually if needed.

## Priority (create first)

1. **Glossary** — unify terms in When/While triggers
2. **Context diagram** — system boundary and external actors/systems

## Add When Complexity Warrants

| Material | When | Strengthens EARS pattern |
| -------- | ---- | ------------------------ |
| State transition diagram/table | Complex status flows | State-driven |
| Screen flow diagram | Long UI flows | Event-driven / State-driven |
| Error-handling matrix | Many exception patterns | Unwanted Behavior |
| Domain model (conceptual) | Complex entity relations | All |
| Integration spec | External system coupling | Event-driven / State-driven |
| UI mock | User-operated features | State-driven / Optional |
| Data lifecycle diagram | Migration, retention, batch | Batch / non-functional |

## Material ID Naming

Examples: `Glossary-01`, `Context-01`, `UC-Order-01`, `State-02`, `Flow-03`, `ErrMatrix-01`

Assign IDs in supplement files as `## {Material-ID}` headings (stable anchor targets). Update `requirements.md` AC table with relative-path links. Use `-` when no supplement applies.

## AC Reference Link Format

Paths are **relative to** `docs/specs/<feature>/requirements.md`. Use Markdown links with a human-readable label (for stakeholder review).

| Supplement file | Relative path from `requirements.md` | Example link |
| --------------- | ------------------------------------ | ------------ |
| Glossary | `../_shared/glossary.md` | `[用語集](../_shared/glossary.md#glossary-01)` |
| Context diagram | `../_shared/context-diagram.md` | `[コンテキスト図](../_shared/context-diagram.md#context-01)` |

Rules:

- Use `#` + lowercase slug of the Material ID as anchor (e.g. `Glossary-01` → `#glossary-01`)
- Multiple supplements: comma-separated links (e.g. `[用語集](...), [UC図](...)`)
- Do not use repo-root absolute paths (`docs/specs/...`) in the AC column

## Supplement File Conventions

- Create or update supplement files (with `## {Material-ID}` heading per material)
- Reference supplements via relative-path links (e.g. from `requirements.md`「関連する補足資料」column) — no new ACs outside PO-validated scope
