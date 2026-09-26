---
name: sdd-validate-requirements
description: Review the requirements once and write reviews/requirements-review.md. Do not ask the human.
metadata:
  shared-rules: "rules/review.md"
disable-model-invocation: true
---

# Requirements review

The subject is `docs/specs/<feature>/requirements.md`. The bar is `rules/review.md`. Also read the brief, `spec.json`, `product.md`, `tech.md`, and `structure.md` when they exist.

`.agents/skills/sdd-spec/scripts/sdd.py` checks marks, secrets, and that an EARS keyword exists. It does not judge `## Quality`, `## Checks`, where an action starts, or whether a kept-item list is closed. You do, under `## Meaning`. This skill is not dispatched when `details.checks` is non-empty.

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

## Specialists
### PO
- pass: <what was compared>

### QA
- pass: <what was compared>

### Sec
- pass: <what was compared>

## Evidence
- traceability: pass: <what was compared>
- roadmap: N/A: <why nothing to compare>
- failures: pass: <what was compared>
- privacy: N/A: <why nothing to compare>
- abuse: N/A: <why nothing to compare>
- steering-security: N/A: <why nothing to compare>
- operability: N/A: <why nothing to compare>
- compliance: N/A: <why nothing to compare>
- template: pass: <what was compared>
- fixes: pass: <what was compared>

## Meaning
- functional: pass: <the bad result, and a quote of the criterion result that fails it>
- reliability: pass: <the bad result, and the criterion result that fails it>
- usability: pass: <the bad result, and the criterion result that fails it>
- performance: pass: <the bad result, and the criterion result that fails it>
- maintainability: pass: <the bad result, and the criterion result that fails it>
- security: pass: <the bad result, and the criterion result that fails it>
- leakage: pass: <the bad result, and the criterion result that fails it>
- destruction: pass: <the bad result, and the criterion result that fails it>
- lockout: pass: <the bad result, and the criterion result that fails it>
- rewrite: pass: <the bad result, and the criterion result that fails it>
- place: pass: <each action and the place named on that same line>
- lists: pass: <every kept item the list names>

## Approval summary
### Accepted residual risks

## Phase Gate
- STATUS: VERIFIED
```

Write `VERIFIED` only together with `GO`. Under Accepted residual risks write `なし` unless every bullet is a consequence a criterion already states. A missing observable result is NO-GO in Findings, not a residual risk. `.agents/skills/sdd-spec/scripts/sdd.py` treats any other residual bullet as unsettled and returns to grill. It also withholds `GO` until `## Evidence` has all ten domains, `## Specialists` has PO, QA, and Sec, and `## Meaning` has all twelve lines, each as `pass:`, `finding:`, or `N/A:` with a reason. A `pass:` or `finding:` must quote a span that is in `requirements.md`. It checks that the quote is present. It does not grade the reason. A `finding:` is `VERDICT: NO-GO`. Any `NO-GO` on this review returns to grill. Do not edit a criterion so that a word appears. On `performance`, a number the human chose is unsettled until the criterion states that limit, even when the words are not the same characters.
