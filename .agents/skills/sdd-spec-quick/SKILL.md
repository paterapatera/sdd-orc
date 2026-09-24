---
name: sdd-spec-quick
description: Orchestrator-only S-tier quick-path. Generates requirements, design, and tasks in one run, then a sanity review. Escalates to M when requirements leave Open questions. Dispatched by /sdd-orchestrate (要求新規作成 (S)).
disable-model-invocation: true
---

# Quick Spec Generator (S quick-path)

<background_information>
Run only from `/sdd-orchestrate` after the brief grill is READY and the tier is S (`../sdd-orchestrate/rules/flows.md` § 要求新規作成 (S)). `$1` is the feature. `brief.md` exists. Run every phase without stopping for the human. Read each phase skill by path (`../sdd-spec-*/SKILL.md`) and ignore its "return to the orchestrator" section until the end of this skill.

This skill does **not** set `ready_for_implementation`, emit the PR Summary, or start implementation. The orchestrator owns Terminal auto-approve (S).
</background_information>

<instructions>
## Phases

Print one progress line per phase (e.g. `Phase 2/3 complete: design generated`).

Skip a phase only when its disk record is current. A skipped phase was not rewritten in this run.

### Phase 1: Requirements

Skip when `approvals.requirements.generated === true` and `requirements.md` has no `Open question:` bullet. Otherwise run `../sdd-spec-requirements/SKILL.md` for `$1` (Step 0 initializes `spec.json` + stub).

Then check `requirements.md` `## スコープ境界` for `Open question:` bullets. If any exist, the brief did not settle the requirements, so S was the wrong tier: **stop here** (do not generate design) and return `QUICK: ESCALATE_M` with the bullets. The orchestrator switches to M and continues the 要求ブロック at the req grill.

### Phase 2: Design

Skip when this run skipped Phase 1, `approvals.design.generated === true`, `design.md` exists, and `spec.json` `source_sha256.requirements_at_design` equals `sha256sum` of `requirements.md`. Otherwise run `../sdd-spec-design/SKILL.md` for `$1`.

### Phase 3: Tasks

Skip when this run skipped Phase 2, `approvals.tasks.generated === true`, and `spec.json` `source_sha256.design_at_tasks` equals `sha256sum` of `design.md`. Otherwise run `../sdd-spec-tasks/SKILL.md` for `$1`.

### Final Sanity Review

Always run, including when every phase was skipped.

- Review `requirements.md`, `design.md`, and `tasks.md` from disk. Use `brief.md` only as supporting context.
- Prefer a fresh review sub-agent. Pass only file paths and the review objective; the reviewer reads the files itself. Otherwise run inline.
- Focus:
  - Do requirements, design, and tasks tell a coherent story?
  - Obvious contradictions, missing prerequisites, or missing task coverage for required design work?
  - Are `_Depends:_`, `_Boundary:_`, and `(P)` markers plausible for implementation?
- Task-plan-local issues only → repair `tasks.md` once, then re-run the sanity review.
- A real requirements/design gap or contradiction → set `spec.json` `quick_sanity` to `follow_up` and return `QUICK: FOLLOW_UP` with the exact finding. Do not claim success. Do not set `ready_for_implementation`.

On success, set `spec.json` `quick_sanity` to `passed` and `complexity_tier: S` if missing. Do not set `ready_for_implementation`. The orchestrator owns Terminal auto-approve (S).

</instructions>

## Return to the orchestrator

One line, then at most 5 bullets of evidence:

| Line | When | Orchestrator action |
| ---- | ---- | ------------------- |
| `QUICK: DONE` | All three `approvals.*.generated === true` and the sanity review passed | Terminal auto-approve (S) |
| `QUICK: ESCALATE_M` | Phase 1 left `Open question:` bullets | Set tier M; continue the 要求ブロック (req grill → validate) → Phase terminal (要求) |
| `QUICK: FOLLOW_UP` | Sanity review found a requirements/design gap, or a phase stopped | Stop; report the finding to the human |

## Safety & Fallback

- **Template missing / directory creation failed**: stop; return `QUICK: FOLLOW_UP` with the path.
- **Phase failure**: stop; return `QUICK: FOLLOW_UP` with the completed phases and the failing phase.
