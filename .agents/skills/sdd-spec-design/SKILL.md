---
name: sdd-spec-design
description: Write design.md from requirements.md. On greenfield, do not write a gap study.
disable-model-invocation: true
---

# Design

The artifact is `docs/specs/<feature>/design.md`. Do not create `research.md`. When the feature changes existing behavior, set `Record.current` to `{ "constraint": "<one line>", "evidence": "<path>" }`. Otherwise `current` is null.

Read the requirements, `tech.md`, `structure.md`, and only the contracts this design changes. Do not read the contracts directory in bulk.

`diff` edits the changed requirements and the design that covers them. `full` covers the whole requirements document.

Required markdown is `## Overview` (what is true when this is done, at most two sentences) and `## Record` (one json fence). The fence keeps these keys:

- `owns`, `must_not`, `depends`: strings. Empty array means none.
- `files`: `{ "path", "change" }`.
- `contracts`: `{ "path", "mode" }` where mode is `modify` or `reference`. `modify` files already exist and are updated in this phase.
- `decisions`: `{ "id": "D-<name>", "choose": "<one line>", "rejected": null }`. `rejected` is one line only when a real alternative was tempting.
- `failures`: `{ "req": "<requirement id>" }` only when an acceptance criterion states a failure, a limit, or an invalid transition.
- `components`: `{ "id": "D-<Name>", "reqs": ["<id>"], "io": "<input -> output>" }` only for a new boundary.
- `current`: the object above, or null.

Add markdown only for ids that exist in the fence:

- `## Decisions` / `### D-<name>` — the because sentence. The heading id matches `decisions[].id`.
- `## Failures` / `### <req id>` — what an outsider observes. The heading matches `failures[].req`.
- `## Components` / `#### <Name> {#D-<Name>}` — the responsibility sentence. The anchor matches `components[].id`.

Do not add a heading, a diagram, or a key the requirements do not force. Do not write secret values. Dependency direction follows steering.

One ADR file per decision that changes a dependency direction, breaks a public contract, or picks a technology later readers must not reverse. One contract file per public surface. Register both in their index README. Point `contracts[].path` at the contract. Do not put the contract body in `design.md`.

When `details.checks` is set, fix only those items. Do not leave an unsettled mark, a secret, `Boundary Candidates`, or `RED`. Do not add a mechanism the requirements do not ask for.

Set `approvals.design.generated` to true. Set `source_sha256.requirements_at_design` to the SHA256 of `requirements.md` at write time. Keep other keys.

A bad design restates the requirements without a boundary, invents an empty section, or splits the same fact between the fence and a heading that does not share its id.
