---
name: sdd-verify-completion
description: A completion claim needs evidence taken in this turn. Do not use this skill as an implementation gate.
disable-model-invocation: true
---

# Evidence

A claim is complete only when a command run in this turn covers the same scope as the claim. Chat memory and an earlier chunk's log are not a pass.

Chunk review is `sdd-review`. The check after every task is done is one run of `sdd-validate-impl`. Do not call this skill as another gate before or after those.
