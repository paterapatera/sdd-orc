---
name: sdd-review
description: Review one implementation chunk against the spec excerpts, the boundary, and the test evidence.
disable-model-invocation: true
---

# Implementation review

Review only the task ids and the diff that were passed in. Do not search the full spec. Use the excerpts, the test results, and whether the change stays inside the boundary.

A good change makes the acceptance behavior observable in a test, stays inside the design boundary, and leaves no secret or unsettled mark. RED is the record of a test that failed before the production code. The presence or absence of a flag is not the judgment.

A bad change writes the test together with the production code so the failure was never seen, changes files outside the boundary, or reports a failing test as passing.

One line: `APPROVED` or `REJECTED`. On `REJECTED`, name the file to fix and the observation that failed.
