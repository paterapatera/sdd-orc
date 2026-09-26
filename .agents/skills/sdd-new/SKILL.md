---
name: sdd-new
description: Write a brief for the request. Update the roadmap when there is a dependency. Stop after the files are written. Do not start specification in this conversation.
---

# sdd-new

The artifact is the brief on disk, plus `path`, `proposed_speed`, and `scale` in `spec.json`. Add a roadmap row when a dependency needs one. This conversation is done when the files are written. Do not start `/sdd-spec`.

## A good brief

- `## Desired Outcome` is 1–3 sentences on what is true when the work is done.
- `## Scope` In / Out contains only the range the request stated. Do not fill blanks.
- `## Background` exists only when the human wrote a motive. Transcribe that motive. Omit the section otherwise.
- `spec.json` `path` is `none` (no spec), `update` (change an existing spec), or `new` (a new spec). When more than one spec is new, append dependency-ordered rows to `docs/steering/roadmap.md`. Do not clear completed `[x]` rows.
- `spec.json` `proposed_speed` is `light` or `normal`. Light writes design and tasks in one pass after the requirements check. Normal keeps phases separate. `/sdd-spec` adopts this proposal unless the human names `light` or `normal` in that conversation. Leave `speed` null.
- Set `scale` to `large` only when a human must also stop at the design check. Otherwise `scale` is null.
- Create `spec.json` from `docs/settings/templates/specs/init.json` when it is missing. Set `feature_name`, timestamps, `path`, `proposed_speed`, and `scale`. Keep every other key when the file already exists.
- The feature name is a short concept. Add an `NNN-` prefix only when the human gives a number. If that directory already exists, ask and stop.

## A bad brief

- Acceptance criteria, design, tasks, or implementation steps are mixed in.
- Background contains a pain the human did not state.
- Path is written as A–E, or written into the brief instead of `spec.json`.
- Speed is scored by counting bullets, or `speed` is set before the human chooses it.
- Outside split mode, the file is written before confirmation. Ask once: 「この brief でよいか？ はい = ファイルに書く。修正があれば内容を書いてください。」
- After はい, this conversation starts `/sdd-spec` or implementation.

## Split mode

`/sdd-spec` dispatches this skill as `split-brief` with `details.split` (new feature names) and `details.source` (the parent's `req-grill.md`). The human already chose the split in the grill, so do not ask for confirmation.

- Read only the `## Split` lines for those names and the matching `## Human choices` lines in the source. Do not read the parent's chat or requirements.
- For each name, write `docs/specs/<name>/brief.md`. `## Desired Outcome` is one sentence from the moved action in the human's words. `## Scope` In is that action. Out stays empty. Omit Background.
- Create `spec.json` from the init template with `path` `new`, `proposed_speed`, `scale` null, and `split_from` set to the parent feature.
- Append a row per name to `docs/steering/roadmap.md` under `## Specs (dependency order)`, after the parent's row, as `- [ ] <name> -- <one line>. Dependencies: <deps from the Split line>`. Add the parent's row first when it is missing. Create the file with `# Roadmap` and that heading when it is missing.
- If `docs/specs/<name>/` already exists, write nothing for that name and report it.

Stop when the files are written. Do not start `/sdd-spec` for the new names.

`none` does not require a brief. A memo, if needed, goes under `docs/captures/`. Write `spec.json` with `"path": "none"`. `update` and `new` write `docs/specs/<feature>/brief.md` and `spec.json`.
