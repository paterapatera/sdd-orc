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

`GO` only when the criteria are observable, the command succeeds, and no unexplained change sits outside the boundary. Do not check the same evidence a second time.
