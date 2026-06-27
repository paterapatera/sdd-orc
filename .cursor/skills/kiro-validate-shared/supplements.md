# Requirements Supplement Materials

Read only when executing `/kiro-validate-requirements-doc`.

## Purpose

Support EARS `requirements.md` with reference materials. Link each AC to material IDs in the「関連する補足資料」column.

## Placement

| Material | Scope | Path example |
| -------- | ----- | ------------ |
| Glossary / data dictionary | Project-wide | `docs/specs/_shared/glossary.md` |
| Context diagram | Project-wide | `docs/specs/_shared/context-diagram.md` |
| Use-case diagram | Per domain | `docs/specs/<domain>/supplements/use-case-diagram.md` |
| Other supplements | As needed | `docs/specs/<domain>/supplements/` |

## Templates

Copy from `docs/settings/templates/specs/supplements/` when creating priority supplements (extend existing project-wide files in place when they already exist):

| Material | Template |
| -------- | -------- |
| Glossary | `glossary.md` |
| Context diagram | `context-diagram.md` |
| Use-case diagram | `use-case-diagram.md` → output under `docs/specs/<feature>/supplements/` |
| State transition diagram/table | `state-transition.md` → output under `docs/specs/<feature>/supplements/` |
| Error-handling matrix | `error-handling-matrix.md` → output under `docs/specs/<feature>/supplements/` |

## Priority (create first)

1. **Glossary** — unify terms in When/While triggers
2. **Context diagram** — system boundary and external actors/systems
3. **Use-case diagram** — one per domain to keep readability

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

Assign IDs in supplement files. Update `requirements.md` AC table references. Use `-` when no supplement applies.

## Doc Skill Outputs

- Create or update supplement files
- Update「関連する補足資料」column in `requirements.md` (no new ACs outside PO-validated scope)
- Write `reviews/requirements-doc.md` per shared contract
