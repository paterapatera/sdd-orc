---
name: sdd-spec
description: Advance one phase for the given feature. The next action is python3 .agents/skills/sdd-spec/scripts/sdd.py next. Run it once and stop.
metadata:
  shared-rules: "rules/gates.md"
disable-model-invocation: true
---

# sdd-spec

`<feature>` is a required argument. Do not infer it from the branch, the chat, or by scanning `docs/specs/`. If it is missing, ask and stop.

Run `python3 .agents/skills/sdd-spec/scripts/sdd.py next <feature> [flags]` once. Do not re-derive the JSON.

At start, read `awaiting` in `spec.json`. If it is set, pass `--ack`. Pass `--speed light` or `--speed normal` only when the user names a speed in this conversation. If they name both, ask and stop.

| User says | flag |
| --- | --- |
| 要求更新, 要求だけ更新 | `--flow requirements-update` |
| 設計更新, 設計だけ, 設計のみ | `--flow design-update`, and `--force` on the first `next` of this conversation only |
| 実装のみ, 実装だけ | Tell them to run `/sdd-impl <feature>`. Do not call `next` |
| Explicitly accepts an incomplete implementation | `--allow-incomplete` |
| Explicitly continues despite unfinished upstream | `--allow-upstream` |

When `spec.json` exists, apply `mutations` in order. `set` writes that key. `touch` sets `updated_at` to now (ISO-8601). Keep every other key. Apply the same mutations again if the action creates the file.

When `isolate` is true, the parent does not write the artifact. Pass a new subagent only the skill path, `args`, `details`, and the target paths. Do not pass the generation chat or draft reasoning. The subagent model is composer-2.5. Run the skill in this context only when the host cannot spawn a subagent.

`phase-terminal` emits Phase Handoff from `rules/gates.md` and stops. `auto-approve` emits the PR Summary from that file and stops. Do not start `/sdd-impl`. `stop-*` reports `reason` and `details` and stops. `GRILL: WAITING` emits Grill 待ち and stops.

Do not call `next` again in this invocation. The next phase is the next `/sdd-spec <feature>`.
