---
name: sdd-eval
description: Run the sample requests in evals/cases through /sdd-new and /sdd-spec, play the human from answers.md, score the artifacts against expect.md, and compare with the previous run. Run after changing any sdd skill or sdd.py. This file stays in the skill repository. It is not part of the .agents and docs copy used by a real project.
disable-model-invocation: true
---

# sdd-eval

This procedure lives next to `evals/cases/`. A real project copies `.agents` and `docs` only, so it does not receive this file.

The argument is a case name under `evals/cases/`, or nothing for every case. Each case has `request.md` (the human's first words), `answers.md` (the human's answers), and `expect.md` (what good artifacts contain). A skill change is kept only when `scripts/eval_check.py` prints `RESULT: OK` for every case.

## Run

The feature name is `eval-<case>`. If `docs/specs/eval-<case>/` exists, ask and stop. Do not read `expect.md` until scoring. The runner must not steer the artifacts toward it.

1. Send `request.md` to `/sdd-new` as the request, with the feature name `eval-<case>`. Answer the brief confirmation with はい.
2. Run `/sdd-spec eval-<case>` as that skill says, with these changes, until `auto-approve` or a `stop-*` action.
   - Where the skill would call AskQuestion, do not call it. Choose for the human from `answers.md`: the option that means the same as a line. When no line answers the question, choose by the `default` line and mark it `unanswered`. Never choose 「持ち帰る」.
   - Append every question to `questions.md` in the run directory as `## <id>`, the prompt, the options, and `chosen: <label>` (plus `unanswered` when marked).
   - At a Phase Handoff, send `/sdd-spec eval-<case>` again with nothing added.
3. Copy `brief.md`, `requirements.md`, `design.md`, `tasks.md`, `req-grill.md`, `spec.json`, and `reviews/` from `docs/specs/eval-<case>/` into `evals/results/<YYYYMMDD-HHMM>-<case>/`. Also copy, under `split/<name>/`, every `docs/specs/<name>/` whose `spec.json` has `split_from` `eval-<case>`. Write the last action and its reason into `run.md`.
4. Delete those `docs/specs/` directories and their rows in `docs/steering/roadmap.md`.

## Score

A new subagent scores. Pass it only `evals/cases/<case>/expect.md` and the run directory. Do not pass the run's chat. It writes `score.md` in the run directory:

```markdown
case: <case>

- E1: pass — "<text copied exactly from the artifact>" (requirements.md)
- E2: fail — <one sentence on what is missing>
- E9: pass — none found (design.md)
```

One line per expect item. A `pass` quotes the artifact exactly, and names the file relative to the run directory. Items marked `[absence]` pass with `none found`. When the run stopped before an artifact exists, its items fail.

Then run `python3 scripts/eval_check.py evals/results/<run>`. It checks that every quote exists, runs the mechanical checks of `.agents/skills/sdd-spec/scripts/sdd.py`, and fails any item that went from pass to fail since the previous run of the case.

## Report

Per case, report the score, the previous score, each `NG` line, and the unanswered count. An `unanswered` question means the skills asked something the case did not foresee. Tell the user whether to add that answer to `answers.md`. Do not edit `answers.md` or `expect.md` yourself.
