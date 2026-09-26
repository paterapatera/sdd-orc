---
name: sdd-validate-impl
description: After every task is done, check the spec once as a whole.
disable-model-invocation: true
---

# Integration check

Run only when every task in `tasks.md` has `status` `done` and `blocked` null. A legacy checkbox file is ready when every leaf is `[x]` and none is `_Blocked:_`. Do not run it on an intermediate chunk.

Check that each acceptance criterion is observable in a test or a run, that the design boundaries do not contradict each other, and that no secret or unsettled mark remains. Run the repository's existing test command once.

Write one file, `docs/specs/<feature>/reviews/impl-review.md`.

```markdown
## Verdict
- VERDICT: GO

## Evidence

## Findings
```

`GO` only when the criteria are observable, the command succeeds, and no unexplained change sits outside the boundary. Each `## Checks` line that cites a criterion has evidence from this run that the bad implementation in `.agents/skills/sdd-spec-requirements/rules/quality.md` fails. A cited removal has evidence for whether it can come back, not only for a rejected value that was not stored. A criterion that names where an action starts has evidence that starting from another place fails. A new screen's opening place, its items, the place each action opens, and the place a failure leaves the user have evidence that the other result fails. A screen the user cannot open fails. A numeric limit in a criterion has evidence that exceeding it fails. A number that exists only in the design is not that evidence. A sourced `out:` needs no run. Do not check the same evidence a second time. The product is not complete while this verdict is not `GO`.
