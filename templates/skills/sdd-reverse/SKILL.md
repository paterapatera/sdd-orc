---
name: sdd-reverse
description: Record existing behavior as specifications without changing it. Use when the user runs /sdd-reverse.
---

# sdd-reverse

Docs directory: `__SDD_DOCS_DIR__`. Write bodies in `__SDD_LANG__`. Issue directory: `__SDD_DOCS_DIR__/issues/<current-branch>/`.

Run setup check first. Stop unless `proposal.md` has `Type: docs` and requirements, research, design, and task are absent. Stay on the issue branch. Cover at most one domain.

Write `requirements.md` with ADDED requirements, New domain, and New capability only, plus the Purpose and Scope sections a new spec needs. Do not change behavior. Record the code evidence as `path:line` under Context Current behavior. Ask at most 5 questions at a time when the code does not show whether something is a defect or a requirement. Leave unanswered items in Open Questions.

Run stamp and check. Commit only this issue directory as `docs`. Close later with `/sdd-close`. A docs-only issue may close without design or task, and check rejects any delta operation other than additions. `/sdd-close` stops while an Open Question remains.
