---
name: sdd-validate-design
description: Review the design once and write reviews/design-review.md. Do not ask the human.
metadata:
  shared-rules: "rules/review.md"
disable-model-invocation: true
---

# Design review

The subject is `docs/specs/<feature>/design.md` and `requirements.md`. The bar is `rules/review.md`. Also read `tech.md`, `structure.md`, and only the paths listed in the design's `## Record` `contracts` array.

Marks, secrets, and the presence of `reversible` are already checked. Walk the tree in `rules/review.md`. Write `GO` only when that frontier is empty. This skill does not run when `details.checks` is non-empty.

Edit only `design.md` and `reviews/design-review.md`. Do not edit `requirements.md`. Requirements SHA256 is `requirements.md` before this review. Design SHA256 is `design.md` after the last edit. Record edits in `## Reflected Fixes`.

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
- edges: pass: <an input or dependency branch, or why it has none left assumed>
- preconditions: pass: <the happy-path state the rest of the design allows>
- tests: pass: <the seam for each stated failure>
- structure: pass: <owner, direction, and the file compared>
- adr: N/A: <why no decision needs an ADR>
- surface: N/A: <why logs, rollout, and versioning have nothing to compare>
- fixes: pass: <no edits, or the rows checked>

## Approval summary
### Accepted residual risks

## Phase Gate
- STATUS: VERIFIED
```

When no contract was read, set paths to `none`. Write `VERIFIED` only when the verdict is `GO`, the hashes match the final files, and `## Evidence` has every domain from `rules/review.md` and `## Specialists` has QA, Arch, and Sec. Each `pass:` and `finding:` quotes a span from `requirements.md` or `design.md`. `.agents/skills/sdd-spec/scripts/sdd.py` checks that the quote is present and does not grade the reason. On `NO-GO`, write `## Route` as `- next: grill` when the requirements must change, or `- next: design` when the design must change. It reads that line and does not search the findings. Omit `## Route` on `GO`.
