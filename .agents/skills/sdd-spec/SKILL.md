---
name: sdd-spec
description: Advance <feature> until a human checkpoint. Each step is python3 .agents/skills/sdd-spec/scripts/sdd.py next. Repeat that command until a stop action.
metadata:
  shared-rules: "rules/gates.md"
disable-model-invocation: true
---

# sdd-spec

`<feature>` is a required argument. Do not infer it from the branch, the chat, or by scanning `docs/specs/`. If it is missing, ask and stop.

Run `python3 .agents/skills/sdd-spec/scripts/sdd.py next <feature> [flags]`. Do not re-derive the JSON. After a continued step finishes, run `next` again in this same invocation. Stop only on a stop action.

At start, read `awaiting` in `spec.json`. If it is already set, pass `--ack` on every `next` in this invocation. `awaiting` written by this invocation is not an ack. Pass `--speed light` or `--speed normal` when the user names a speed in this conversation, and keep that flag on later `next` calls. If they name both, ask and stop. If they name neither and the action is `needs-speed` with `details.proposal` of `light` or `normal`, adopt that proposal and call `next` again with `--speed`. Ask and stop only when that proposal is missing.

| User says | flag |
| --- | --- |
| 要求更新, 要求だけ更新 | `--flow requirements-update` |
| 設計更新, 設計だけ, 設計のみ | `--flow design-update`. `--force` only on the first `next` of this invocation |
| 実装のみ, 実装だけ | Tell them to run `/sdd-impl <feature>`. Do not call `next` |
| Explicitly accepts an incomplete implementation | `--allow-incomplete` |
| Explicitly continues despite unfinished upstream | `--allow-upstream` |

When `spec.json` exists, apply `mutations` in order before the next `next`. `set` writes that key. `touch` sets `updated_at` to now (ISO-8601). Keep every other key. Apply the same mutations again if the action creates the file.

When `isolate` is true, the parent does not write the artifact. Pass a new subagent only the skill path, `args`, `details`, and the target paths. Do not pass the generation chat or draft reasoning. The subagent model is composer-2.5. Run the skill in this context only when the host cannot spawn a subagent. Each continued step gets its own subagent.

Continue after these actions, once the step has finished and mutations are applied: `spec-requirements`, `review-requirements`, `spec-design`, `review-design`, `spec-tasks`, `spec-quick`, `split-brief`. `grill-req` continues only when the grill ends with `GRILL: READY`. For `split-brief`, the subagent follows § Split mode of the `sdd-new` skill.

Stop actions, after mutations are applied:

- `needs-speed` with no proposal. Ask which speed.
- `phase-terminal`. Emit Phase Handoff from `rules/gates.md`.
- `needs-choice`. Call AskQuestion once, one question per item in `details.questions`. Use each item's `prompt` and `options`. The last option is 「持ち帰る」. Do not print the choices again as a lettered list. When the phase is `design`, write a kept or changed label into `docs/specs/<feature>/design-grill.md` under `## Human choices` as `- <id>: <label>`. When the phase is `tasks`, write it into `docs/specs/<feature>/tasks-grill.md` the same way. Write 「持ち帰る」 under `## DEFERRED` instead. Then run `next` again only when every answer is under Human choices. Do not run `next` while a deferred item remains.
- `stop-design-deferred`. The recommendation is deferred. Report `details.ids`. Do not call `next`.
- `stop-tasks-deferred`. The physical recommendation is deferred. Report `details.ids`. Do not call `next`.
- `auto-approve`. Emit the PR Summary from that file. Do not start `/sdd-impl`.
- `stop-*`, `instruct-impl`, `instruct-discovery`. Report `reason` and `details`. For `stop-split-exists`, tell the user to rename the listed lines under `## Split` in `req-grill.md`.
- Grill ends with `GRILL: ASK`, or with unanswered choices while `## DEFERRED` is empty. Call AskQuestion once, one question per item, options taken from the grill (the last is 「持ち帰る」). Do not print the choices again as a lettered list. Do not ask for a typed code or another `/sdd-spec` before the click. Write each selected label into `req-grill.md` under `## Human choices` as `- <id>: <label>`. Run `sdd-grill` again so the answerer can transcribe. Do not emit Grill 待ち.
- Grill ends with `GRILL: WAITING` and `## DEFERRED` has items. Emit Grill 待ち. Do not call `next`.
- Grill ends with anything else. Report that ending. Do not call `next`.

If the same `action` comes back and `requirements.md`, `design.md`, `tasks.md`, `req-grill.md`, `tasks-grill.md`, both review files, and `spec.json` are unchanged, stop and report that the step did not advance. Stop after 12 `next` calls in this invocation and tell the user to send `/sdd-spec <feature>` again.
