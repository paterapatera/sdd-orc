---
name: sdd-new
description: Write a brief for the request. Update the roadmap when there is a dependency. Stop after the files are written. Do not start specification in this conversation.
---

# sdd-new

The artifact is the brief on disk. Add a roadmap row when a dependency needs one. This conversation is done when the files are written. Do not start `/sdd-spec`.

## A good brief

- `## Desired Outcome` is 1–3 sentences on what is true when the work is done.
- `## Scope` In / Out contains only the range the request stated. Do not fill blanks.
- `## Background` transcribes only the occasion the human wrote. Omit the section when they gave no motive.
- `## Route` Path is one of `none` (no spec), `update` (change an existing spec), or `new` (a new spec). When more than one spec is new, append dependency-ordered rows to `docs/steering/roadmap.md`. Do not clear completed `[x]` rows.
- `## Route` Speed is `light` or `normal`. Light writes design and tasks in one pass after the requirements check. Normal keeps phases separate. This is a proposal. The human chooses it on `/sdd-spec`.
- Write `**Scale**: large` only when a human must also stop at the design check.
- The feature name is a short concept. Add an `NNN-` prefix only when the human gives a number. If that directory already exists, ask and stop.

## A bad brief

- Acceptance criteria, design, tasks, or implementation steps are mixed in.
- Background contains a pain the human did not state.
- Path is written as A–E.
- Speed is scored by counting bullets.
- The file is written before confirmation. Ask once: 「この brief でよいか？ はい = ファイルに書く。修正があれば内容を書いてください。」
- After はい, this conversation starts `/sdd-spec` or implementation.

`none` does not require a brief. A memo, if needed, goes under `docs/captures/`. `update` and `new` write `docs/specs/<feature>/brief.md`.
