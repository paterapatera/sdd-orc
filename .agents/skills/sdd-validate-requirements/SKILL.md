---
name: sdd-validate-requirements
description: Review the requirements once and write reviews/requirements-review.md. Do not ask the human.
metadata:
  shared-rules: "rules/review.md"
disable-model-invocation: true
---

# Requirements review

The subject is `docs/specs/<feature>/requirements.md`. The bar is `rules/review.md`. Also read the brief, `spec.json`, `product.md`, `tech.md`, and `structure.md` when they exist.

`.agents/skills/sdd-spec/scripts/sdd.py` already ran the mechanical checks. This skill is not dispatched when `details.checks` is non-empty.

Edit only `requirements.md` and `reviews/requirements-review.md`. Record the SHA256 of `requirements.md` before edits as Input, and after the last edit as Output. Each edit is one `## Reflected Fixes` row with the place and the change. Do not mark GO for a fix that is claimed but absent from the text.

Do not add intent, scope, or an acceptance bar. When one of those is required, write `VERDICT: NO-GO` and name grill in Findings.

```markdown
## Verdict
- VERDICT: GO
- Input SHA256: <before edits>
- Output SHA256: <after the last edit>

## Summary

## Findings

## Decisions

## Reflected Fixes

## Approval summary
### Accepted residual risks

## Phase Gate
- STATUS: VERIFIED
```

Write `VERIFIED` only together with `GO`.
