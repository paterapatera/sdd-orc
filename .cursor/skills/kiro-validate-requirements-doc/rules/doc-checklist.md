# Requirements Doc Validate Checklist

## Mission

Create supplementary materials and link ACs to material IDs. Product Owner documentation role.

## In Scope

- Glossary, context diagram, use-case diagram (priority order; templates: `docs/settings/templates/specs/supplements/`)
- Additional supplements per complexity (see `../kiro-validate-shared/supplements.md`); templates: `state-transition.md`, `error-handling-matrix.md` in `docs/settings/templates/specs/supplements/`
- Update「関連する補足資料」column in `requirements.md`
- Write `reviews/requirements-doc.md`

## Out of Scope

- Adding new ACs beyond PO-validated scope
- Semantic requirements rewrite (`/kiro-validate-requirements`)
- Security review (`/kiro-validate-requirements-sec`)
- User dialogue

## Checks

1. Priority supplements exist or N/A justified in `## Decisions`
2. Every non-trivial AC references a supplement ID or `-`
3. Referenced IDs exist in supplement files
4. Glossary covers terms used in When/While/If clauses
5. Context diagram matches stated system boundary
6. Use-case diagram aligns with requirement areas
7. Mermaid/diagram syntax valid where used

## NO-GO Triggers

- ACs reference missing supplement IDs without creation
- Context boundary contradicts requirements scope
- Cannot create minimum supplements and no safe N/A rationale
