---
name: sdd-debug
description: Investigate a failed implementation in a context that does not contain that failure's conversation. Do not change code until the cause is known.
metadata:
  shared-rules: "rules/investigation-prompt-template.md"
disable-model-invocation: true
---

# Investigation

The input is the failed command, its output, the task, and the boundary. Do not receive or use guesses from the implementation conversation.

A good investigation reproduces the failure and narrows the cause to one observation before editing. A bad investigation edits production code first and retries until something passes.

Change code only when the reproduced failure becomes a different failure that the change explains. Do not touch secrets or files outside the boundary.
