---
name: sdd-spec-status
description: Read the named fields in spec.json and the task marks. Do not choose the next step.
disable-model-invocation: true
---

# Status

Report only `phase`, `speed`, `path`, `accepted`, `awaiting`, `approvals`, and `ready_for_implementation` from `docs/specs/<feature>/spec.json`, plus whether `tasks.md` has a task whose `status` is not `done` or whose `blocked` is set. A legacy file reports open checkboxes and `_Blocked:_`. If a file is missing, say so. `.agents/skills/sdd-spec/scripts/sdd.py next` chooses the next phase.
