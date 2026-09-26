---
name: sdd-spec-design
description: Write design.md from requirements.md. Look at the repository first. Do not write research.md.
disable-model-invocation: true
---

# Design

The artifact is `docs/specs/<feature>/design.md`. Do not create `research.md`.

Read the requirements (including `## Quality`), `tech.md`, and `structure.md` first. Before writing `depends` or `files`, look at the repository for each thing this feature relies on and does not itself introduce, and for each existing place a `## Screens` `from` line names. Open only the paths that can confirm it: auth configuration, routes, and models. Do not scan the repository in bulk. A session guard, a user model, or auth configuration does not show that a person can log in. When a requirement sends a person who is not logged in to a login screen, the look must find that route and that screen. If either is missing, the dependency is not present. Do not record the guard's path as evidence that login exists. Also read only the contracts this design changes. Each criterion a `## Quality` line cites traces to a component, a decision, or a failure. Do not read the contracts directory in bulk.

Record the look in the design. A dependency the look finds goes in `depends`. Do not add `files` that build it. Set `Record.current` to `{ "constraint": "<what that existing code already does>", "evidence": "<path>" }`. A dependency the look does not find also goes in `depends`, and `current` is `{ "constraint": "<it is not in the repository>", "evidence": "<path that was checked>" }`. Do not add `files` that build it, except the login route and screen below. When several looks need a path, the because sentence of a decision names each extra path. One `current` object. When the feature depends on nothing outside itself, `current` is null.

When the missing dependency is a login route or screen the requirements name, do not decide that another feature will add it. Write one recommendation. `choose` is that this feature adds the minimum login route and screen. `rejected` is that a named earlier feature provides them before this one. Leave those paths out of `files` until the human keeps `choose`. `current.constraint` says the login route is not in the repository, and `evidence` is the routes file that was checked, not the user model. When `details.confirm` selects the label that adds them here, add those paths to `files` and stop saying the route is absent. When it selects the earlier feature, leave them out of `files` and keep that constraint.

For each responsibility this feature adds, look for an existing module that already owns it. Open only the directories `structure.md` names for that layer. Do not scan the repository in bulk. When that module can take the change, `files` lists its path and `change` says it extends that module. Do not add a second file for the same responsibility. When it cannot, `files` lists the new path and one decision records the choice: `choose` is the new file, `rejected` is the existing path, and the because sentence says why that path cannot take the change. When no existing module owns the responsibility, do not add that decision. A repository with no application code yet has nothing to extend.

`diff` edits the changed requirements and the design that covers them. `full` covers the whole requirements document.

Required markdown is `## Overview` (what is true when this is done, at most two sentences) and `## Record` (one json fence). The fence keeps these keys:

- `owns`, `must_not`, `depends`: strings. Empty array means none.
- `files`: `{ "path", "change" }`.
- `contracts`: `{ "path", "mode" }` where mode is `modify` or `reference`. `modify` files already exist and are updated in this phase.
- `decisions`: `{ "id": "D-<name>", "choose": "<one line>", "rejected": null, "reversible": true, "basis": "requirements" }`. `rejected` is one line only when a real alternative was tempting. `reversible` is `false` when the decision fixes how kept data is shaped or identified, picks an outside dependency or technology, changes a public contract, or needs an ADR. A `false` decision stops the flow at the human's design check. `basis` is `recommendation` when the requirements do not determine the choice. Then `choose` is the recommended way, and `rejected` lists the real alternatives separated by ` / `.
- `failures`: `{ "req": "<requirement id>" }` only when an acceptance criterion states a failure, a limit, or an invalid transition.
- `components`: `{ "id": "D-<Name>", "reqs": ["<id>"], "io": "<input -> output>" }` only for a new boundary.
- `current`: the object above, or null.

Add markdown only for ids that exist in the fence:

- `## Decisions` / `### D-<name>` — the because sentence. The heading id matches `decisions[].id`.
- `## Failures` / `### <req id>` — what an outsider observes. The heading matches `failures[].req`.
- `## Components` / `#### <Name> {#D-<Name>}` — the responsibility sentence. The anchor matches `components[].id`.

Do not add a heading, a diagram, or a key the requirements do not force. Do not write secret values. Dependency direction follows steering.

When the requirements determine a choice, `basis` is `requirements`. When they do not, write the recommended way anyway, set `basis` to `recommendation`, and put the other real ways in `rejected`. Do not leave the choice blank, and do not present the recommendation as if the requirements had decided it. The human is asked whether to keep it, switch to an alternative, or defer. When `details.confirm` is set, update only those decisions: set `basis` to `human`, and set `choose` to the selected label unless the label is 「このまま（推奨）」.

When an acceptance criterion says the user sees a result, and that sentence names only the screen or joins two observations with 「または」, write one decision for that result. `basis` is `recommendation`. `choose` is one observation. `rejected` lists the other real observations separated by ` / `. The matching `## Failures` sentence uses only `choose`. Do not leave 「または」 in that sentence. Do not name a widget, a status code, or a column type the requirements do not contain. The result is already in the criterion, so this choice is not a new result.

When a `## Screens` `from` line names a place this feature does not add, `files` includes the existing path that must change so the user can open the screen. A task cannot cover a path the record omits.

A maximum length, whether a spaces-only value is empty, whether a future date is kept, and whether a destructive action asks first stay in the requirements until the human answers. Do not write them as a decision, a failure, or a `must_not` line.

One ADR file per decision that changes a dependency direction, breaks a public contract, or picks a technology later readers must not reverse. One contract file per public surface. Register both in their index README. Point `contracts[].path` at the contract. Do not put the contract body in `design.md`.

When `details.checks` is set, fix only those items. `reversible` adds that key to each decision. Do not leave an unsettled mark, a secret, `Boundary Candidates`, or `RED`. Do not add a widget name, a status code, a column type, or a result the user would see that no criterion states. Whether one of those is being presented as the requirements' decision is the design review's judgment, not a token list.

Set `approvals.design.generated` to true. Set `source_sha256.requirements_at_design` to the SHA256 of `requirements.md` at write time. Keep other keys.

A bad design restates the requirements without a boundary, invents an empty section, or splits the same fact between the fence and a heading that does not share its id.
