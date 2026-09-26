---
name: sdd-validate-design
description: Review the design once and write reviews/design-review.md. Do not ask the human.
metadata:
  shared-rules: "rules/review.md"
disable-model-invocation: true
---

# Design review

The subject is `docs/specs/<feature>/design.md` and `requirements.md`. The bar is `rules/review.md`. Also read `tech.md`, `structure.md`, and only the paths listed in the design's `## Record` `contracts` array.

Marks, secrets, and `reversible` are already checked. You judge whether the design presents a mechanism or a quantity as something the requirements decided. A status code, a deletion method, or a limit counts in any wording, including when the design says it will not use that mechanism. A number the human chose counts when the requirements do not state that limit. This skill does not run when `details.checks` is non-empty.

Edit only `design.md` and `reviews/design-review.md`. Do not edit `requirements.md`. Requirements SHA256 is `requirements.md` before this review. Design SHA256 is `design.md` after the last edit. Record edits in `## Reflected Fixes`.

Do not fill in intent the requirements do not contain. Do not add a `## Boundary` `out:` to record a design decision or a residual risk. A type, a range, or a storage choice stays a recommendation, or returns to grill as a question. It is not an exclusion from the feature. Write `VERDICT: NO-GO` and `## Route` when the requirements must change.

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

## Specialists
### QA
- pass: <what was compared>

### Arch
- pass: <what was compared>

### Sec
- pass: <what was compared>

## Evidence
- traceability: pass: <criterion to element, and element to criterion>
- edges: pass: <each case, and where the design covers it or why it does not change behavior>
- preconditions: pass: <the happy-path state the rest of the design allows>
- tests: pass: <the seam for each stated failure>
- structure: pass: <dependencies, ownership, and files compared>
- extensions: pass: <two changes and where each breaks or is absorbed>
- adr: N/A: <why no decision needs an ADR>
- surface: N/A: <why logs, rollout, and versioning have nothing to compare>
- fixes: pass: <no edits, or the rows checked>

## Approval summary
### Accepted residual risks

## Phase Gate
- STATUS: VERIFIED
```

When no contract was read, set paths to `none`. Write `VERIFIED` only when the verdict is `GO`, the hashes match the final files, and `## Evidence` has all nine domains and `## Specialists` has QA, Arch, and Sec. Each `pass:` and `finding:` quotes a span from `requirements.md` or `design.md`. `.agents/skills/sdd-spec/scripts/sdd.py` checks that the quote is present and does not grade the reason. On `NO-GO`, write `## Route` as `- next: grill` when the requirements must change, or `- next: design` when the design must change. It reads that line and does not search the findings. Omit `## Route` on `GO`.
