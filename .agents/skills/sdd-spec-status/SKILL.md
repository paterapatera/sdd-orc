---
name: sdd-spec-status
description: Read the named fields in spec.json and the task marks. Do not choose the next step.
disable-model-invocation: true
---

# Status

Report only `phase`, `speed`, `accepted`, `awaiting`, `approvals`, and `ready_for_implementation` from `docs/specs/<feature>/spec.json`, plus whether `tasks.md` has open tasks or `_Blocked:_`. If a file is missing, say so. `.agents/skills/sdd-spec/scripts/sdd.py next` chooses the next phase.
