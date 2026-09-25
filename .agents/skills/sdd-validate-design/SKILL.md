---
name: sdd-validate-design
description: Review the design once and write reviews/design-review.md. Do not ask the human.
metadata:
  shared-rules: "rules/review.md"
disable-model-invocation: true
---

# Design review

The subject is `docs/specs/<feature>/design.md` and `requirements.md`. The bar is `rules/review.md`. Also read `tech.md`, `structure.md`, and only the paths listed in the design's Persistent References.

The mechanical checks are already done. This skill does not run when `details.checks` is non-empty.

Edit only `design.md` and `reviews/design-review.md`. Requirements SHA256 is `requirements.md`. Design SHA256 is `design.md` after the last edit. Record edits in `## Reflected Fixes`.

Do not fill in intent the requirements do not contain. Write `VERDICT: NO-GO` and name the artifact to return to in Findings.

```markdown
## Verdict
- VERDICT: GO
- Requirements SHA256: <requirements.md>
- Design SHA256: <design.md after the last edit>

## Summary

## Reviewed Scope
- Reviewed contract paths:
- ADR paths:
- Contract sync: OK

## Findings

## Decisions

## Reflected Fixes

## Approval summary
### Accepted residual risks

## Phase Gate
- STATUS: VERIFIED
```

When no contract was read, set paths to `none`. Write `VERIFIED` only when the verdict is `GO` and the hashes match the final files.
