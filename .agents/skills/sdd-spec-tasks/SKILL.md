---
name: sdd-spec-tasks
description: Orchestrator-only. Generates implementation tasks for a specification. Dispatched by /sdd-orchestrate (タスク phase, and inside sdd-spec-quick).
metadata:
  shared-rules: "tasks-generation.md, tasks-parallel-analysis.md"
disable-model-invocation: true
---


# Implementation Tasks Generator

<background_information>
- **Success Criteria**:
  - All requirements mapped to specific tasks
  - Tasks properly sized (1-3 hours each)
  - Clear task progression with proper hierarchy
  - Natural language descriptions focused on capabilities
  - A lightweight task-plan sanity review confirms the task graph is executable before `tasks.md` is written
</background_information>

<instructions>
## Execution Steps

### Step 1: Load Context

**Read all necessary context**:
- `docs/specs/$1/spec.json`, `requirements.md`, `design.md`
- `docs/specs/$1/tasks.md` (if exists, for merge mode)
- Core steering context: `product.md`, `tech.md`, `structure.md`
- Additional steering files only when directly relevant to requirements coverage, design boundaries, runtime prerequisites, or team conventions that affect task executability

#### Load rules (persistent docs)

| 資料 | このフェーズ |
|------|--------------|
| feature req/design/tasks | **主** |
| architecture / contracts | **関連のみ** — Prefer Persistent References / Boundary-related paths; never bulk-Read |
| ADR | — |

- Never glob-bulk-Read `docs/contracts/**` or `docs/architecture/**`
- Procedure: **index → Persistent References / named related paths → those files only**
- Do not “read everything just in case”
- **Recommended**: annotate executable sub-tasks that touch a public surface with `_Contracts: docs/contracts/<file>.md_` (path form; optional — Persistent References remain the fallback at impl)

**Validate prerequisites**:
- Verify `approvals.requirements.generated === true` and `approvals.design.generated === true` (stop if not, see Safety & Fallback)

**Artifact-only resume**: 前のチャット履歴・口頭の合意・未書き込みの決定を前提にしない。フェーズの入力は上記 Load Context の成果物（および steering）のみ。チャットにしかない意図が必要なら、生成前に成果物へ書いてから続行する（勝手に補完しない）。設計にないコンポーネントや暗黙の実装方針を会話から追加しない。

### Step 2: Generate Implementation Tasks

**Load generation rules and template**:
- Read `rules/tasks-generation.md` from this skill's directory for principles
- Read `rules/tasks-parallel-analysis.md` from this skill's directory for parallel judgement criteria
- Read `docs/settings/templates/specs/tasks.md` for format (supports `(P)` markers)

#### Parallel Research

The following research areas are independent and can be executed in parallel:
1. **Context loading**: Spec documents (requirements.md, design.md), steering files
2. **Rules loading**: tasks-generation.md, tasks-parallel-analysis.md, tasks template

If multi-agent is enabled, spawn sub-agents for each area above. Otherwise execute sequentially.

After all parallel research completes, synthesize findings before generating tasks.

**Generate task list following all rules**:
- Use language specified in spec.json
- Map all requirements to tasks
- When documenting requirement coverage, list numeric requirement IDs only (comma-separated) without descriptive suffixes, parentheses, translations, or free-form labels
- Ensure all design components included
- Verify task progression is logical and incremental
- Ensure each executable sub-task includes at least one detail bullet that states what "done" looks like in observable terms
- Keep normal implementation tasks within a single responsibility boundary; if work crosses boundaries, make it an explicit integration task
- Collapse single-subtask structures by promoting them to major tasks and avoid duplicating details on container-only major tasks (use template patterns accordingly)
- Apply `(P)` markers to tasks that satisfy parallel criteria
- Annotate every executable sub-task with `_Wave: N_` (phase order: Foundation → Core → Integration → Validation; Integration/Validation stay in their own majors; `(P)` + different `_Boundary:_` → different **majors**)
- Mark optional test coverage subtasks with `- [ ]*` only when they strictly cover acceptance criteria already satisfied by core implementation and can be deferred post-MVP
- If existing tasks.md found, merge with new content

### Step 3: Review Task Plan

- Keep the draft task plan in working memory; do NOT write `tasks.md` yet
- Run the `Task Plan Review Gate` from `rules/tasks-generation.md`
- Review coverage:
  - Every requirement ID appears in at least one task
  - Every design component, contract, integration point, runtime prerequisite, and validation concern is represented
- Review executability:
  - Each sub-task is an executable 1-3 hour work unit
  - Each sub-task has a verifiable deliverable
  - Each executable sub-task includes an observable completion bullet
  - Each executable sub-task includes `_Wave: N_` (flag and repair any missing Waves)
  - No implicit prerequisites remain hidden
  - `_Depends:_`, `_Boundary:_`, `_Wave:_`, and `(P)` markers still match the dependency graph, architecture boundaries, and **packed-batch** dispatch rules
- If issues are task-plan-local, repair the draft and re-run the review gate before writing
- Keep the review bounded to at most 2 repair passes
- If review exposes a real requirements/design gap or contradiction, stop with `TASKS: RETURN_TO_DESIGN` instead of inventing filler tasks

### Step 3.5: Run Task-Graph Sanity Review

Before writing `tasks.md`, run one lightweight independent sanity review of the task graph.

- If fresh subagent dispatch is available, spawn one fresh review subagent for this step. Otherwise perform the same review in the current context.
- Provide only file paths, the draft task plan, and merge context if an existing `tasks.md` is being updated. The reviewer should read `requirements.md`, `design.md`, and the task-generation rules directly instead of relying on a parent-synthesized coverage summary.
- Check only:
  - hidden prerequisites or missing setup tasks
  - dependency or ordering mistakes
  - boundary overlap or ambiguous ownership between tasks
  - tasks that are too large, too vague, cross boundaries without being explicit integration tasks, or are missing a verifiable deliverable
  - contradictions introduced between requirements, design, and the task graph
- Return one verdict:
  - `PASS`
  - `NEEDS_FIXES`
  - `RETURN_TO_DESIGN`
- If `NEEDS_FIXES`, repair the draft once and re-run the sanity review one time.
- If `RETURN_TO_DESIGN`, stop without writing `tasks.md`; return `TASKS: RETURN_TO_DESIGN` with the exact gap in requirements/design.
- Keep this bounded. Do not turn it into a second full planning cycle.

### Step 4: Finalize

**Write tasks.md**:
- Create/update `docs/specs/$1/tasks.md`
- Update spec.json metadata:
  - Set `phase: "tasks-generated"`
  - Set `approvals.tasks.generated: true`
  - Update `updated_at` timestamp
  - Do **not** set `ready_for_implementation`. The orchestrator sets it at Terminal auto-approve, after its タスクゲート.

## Critical Constraints
- **Task Integration**: Every task must connect to the system (no orphaned work)
- **Boundary annotations**: Required for `(P)` **majors**, recommended for all (`_Boundary: ComponentName_`)
- **Contracts annotations** (optional, recommended): `_Contracts: docs/contracts/<file>.md_` when the task touches that public surface
- **Wave annotations**: Required on every executable sub-task (`_Wave: N_`) as phase order; `sdd-impl` dispatches **packed batches** of consecutive majors, not by Wave
- **Explicit dependencies**: Cross-boundary non-obvious dependencies declared with `_Depends: X.X_`
- **Executable deliverable granularity**: Each task must produce a verifiable deliverable (file, endpoint, UI component, config). Infrastructure tasks (project scaffolding, manifest, host integration, build config) must be explicit — never assume they exist
- **Observable done state**: Each executable sub-task must include at least one detail bullet that makes the completed state visible without adding new bookkeeping fields
- **No implicit prerequisites**: If a task requires a runtime, SDK, framework setup, or config file, that setup must be a separate preceding task
- **No persistent bulk load**: Never glob-bulk-Read `docs/contracts/**` / `docs/architecture/**` while generating tasks
</instructions>

## Return to the orchestrator

One line, then a summary under 100 words in the spec language (major tasks / sub-tasks count, requirements covered, review gate and sanity review results):

- `TASKS: WRITTEN` — `tasks.md` written, `approvals.tasks.generated: true`, every requirement ID covered
- `TASKS: RETURN_TO_DESIGN` — requirements/design missing, not generated, non-numeric requirement IDs, or a real gap the task plan would have to paper over. Name the gap. `tasks.md` not written

## Safety & Fallback

- **Requirements or design missing / not generated / non-numeric requirement IDs**: `TASKS: RETURN_TO_DESIGN`.
- **Spec gap found during task review**: do not write a patched-over `tasks.md`; `TASKS: RETURN_TO_DESIGN`.
- **Template/rules missing**: inline basic structure with a warning in the summary.
