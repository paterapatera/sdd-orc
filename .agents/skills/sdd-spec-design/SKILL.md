---
name: sdd-spec-design
description: Write design.md from requirements.md. On greenfield, do not write a gap study.
disable-model-invocation: true
---

# Design

The artifact is `docs/specs/<feature>/design.md`. Write the delta to `research.md` first only when changing an existing implementation. Do not create `research.md` when the feature has no existing implementation.

Read the requirements, `tech.md`, `structure.md`, and only the contracts this design changes. Do not read the contracts directory in bulk.

`diff` edits the changed requirements and the design that covers them. `full` covers the whole requirements document.

A good design traces each acceptance criterion to a responsibility, a boundary, and the failure behavior. Public-surface files go in Persistent References as `Mode: modify` or `reference`. Dependency direction follows steering. Do not write secret values.

When `details.checks` is set, fix only those items. Do not leave an unsettled mark, a secret, `Boundary Candidates`, or `RED`. Do not add a mechanism the requirements do not ask for.

Set `approvals.design.generated` to true. Set `source_sha256.requirements_at_design` to the SHA256 of `requirements.md` at write time. Keep other keys.

A bad design restates the requirements without a boundary, or invents an empty operational section.
