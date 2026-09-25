---
name: sdd-spec-quick
description: For light speed, write design and tasks in one pass from requirements that are already confirmed.
disable-model-invocation: true
---

# Light design and tasks

The requirements already exist. This skill writes `design.md` and `tasks.md`. It does not rewrite the requirements, write a review, or set `ready_for_implementation`.

A good design traces each acceptance criterion to a responsibility and a failure behavior. List only the public-surface files in Persistent References. A good task is `- [ ] 1.` or `- [ ] 1.1`, with `_Depends:_` and `_Boundary:_`, and can be written as a test that fails before implementation.

When the existing design's hash matches the requirements, do not rewrite the design. Write only the missing tasks.

Set `approvals.design.generated` and `approvals.tasks.generated` to true. Set `source_sha256.requirements_at_design` and `source_sha256.design_at_tasks` to the SHA256 of the files just written.

If an `Open question:` remains, write nothing and set `quick_sanity` to `follow_up`. When both files are written, set `quick_sanity` to `passed`.
