# Flow Routing

## Resolve Target Feature

Resolve `<feature>` **before** routing. Do not guess from chat history. Do not use the current git branch.

1. **`<feature>` is required** — first argument that is not a flow/tier override (`要求だけ更新`, `要求更新`, `設計だけ`, `設計のみ`, `設計更新`, `quick`, `lite`, `フル`, `full`) and not a reserved redirect token (`実装のみ`, `実装だけ`).
2. **Stop and ask for a spec name** if no such argument is present.

Then continue with § Entry Contract using the resolved `<feature>`.

## Entry Contract (discovery runs standalone)

`/sdd-discovery` is **not** an orchestration step. It is run **standalone before** orchestration and has already produced `brief.md` (new specs), `roadmap.md` (when dependencies exist), and — for existing specs — `spec.json`. Orchestration is invoked with a required target `<feature>` plus optional explicit flow, and selects the active flow without a discovery Path signal:

1. **Implementation is not an orchestration flow.** 「実装のみ」「実装だけ」 (or any request to implement without spec change) → **stop**; instruct `/sdd-impl <feature>`. Do not dispatch `/sdd-impl` from this skill.
2. **User-specified flow wins** — e.g.「要求だけ更新」「設計だけ」.
3. **Else derive from disk** via § Artifact Freshness, then § Spec State Hints. First match wins:
   - Neither `brief.md` nor `spec.json` → **stop**; instruct `/sdd-discovery`. Do **not** auto-run discovery.
   - `brief.md` exists, no `spec.json` → **要求新規作成** (`flows.md` § 要求新規作成 entry)
   - `ready_for_implementation: true` and the user did not request 要求更新 / 設計更新:
     - Design fresh **and** tasks fresh → **stop**. Instruct `/sdd-impl <feature>`.
     - Otherwise the artifacts changed after approval. Set `ready_for_implementation: false`, then continue this list. Do not send the user to implement stale tasks.
   - `complexity_tier` is `S` and the user did not request 要求更新 / 設計更新 / `full` → **S resume** (`flows.md` § 要求新規作成 (S) resume). Do **not** select 設計更新.
   - The 要求ブロック entry table picks a step → resume that step. Skipped when the user explicitly asked for 設計更新.
   - Design is not fresh → dispatch per § Artifact Freshness. A missing design is the 要求新規作成 design step (full generation), not the diff-only 設計更新 flow.
   - Tasks are not fresh → `/sdd-spec-tasks`, then the タスクゲート. Diff-only when `tasks.md` already exists. First generation is not diff-only.
   - All fresh and `ready_for_implementation: false` → タスクゲート, then Terminal auto-approve if `VERIFIED`

**Resume (new session):** A new chat on the **same Git checkout** with `/sdd-orchestrate <feature>` means the human accepted the previous phase artifacts. Choose the next phase from § Artifact Freshness, not from `approvals.*.generated` alone. Same-chat correction notes after Phase Handoff are not resume. Do not create a new worktree per phase.

Path B (no spec) is decided by discovery **before** orchestration and never enters an orchestration flow (see `flows.md` § Path B).

## Complexity Tier (orchestrator inline)

After resolving the active flow, before the first generation dispatch. On 要求新規作成, this runs after brief-grill `READY` (`flows.md` § 要求新規作成 entry):

1. Read `rules/complexity-tier.md`
2. Compute tier from `brief.md` as it stands after brief-grill (+ roadmap if present)
3. Write `complexity_tier` / `complexity_score` / `complexity_rationale` to `spec.json`
4. Map tier → orchestration path (`flows.md` § Orchestration Paths by Tier), then load the matching flow variant (S / M / L suffix)

| Tier | Path | Flow section |
| ---- | ---- | ------------ |
| S | **quick-path** | `要求新規作成 (S)` → `/sdd-spec-quick` |
| M | **standard-path** | `要求新規作成 (M)` → unified validates; 要求 / 設計 each → Phase terminal; タスクは再開後 |
| L | **full-path** | `要求新規作成 (L)` → full pipeline; 要求 / 設計 each → Phase terminal; タスクは再開後 |

User override: explicit「フル」「lite」「quick」でティア／経路を上書き可。
- 「quick」「lite」→ force S / **quick-path** (regardless of score)
- 「フル」「full」→ force L / **full-path**

Existing specs without `complexity_tier` → treat as **L** for **orchestration path selection** only (not for `/sdd-impl` execution mode — that uses task-count fallback; see `complexity-tier.md` § Scope note). Path D/E → force **L** (never S / never quick-path).

## Determine Active Flow

Combine **`spec.json` state** (§ Spec State Hints) and **user override** to pick one flow:

| Condition | Flow |
| --------- | ---- |
| New spec / new requirements (`brief.md`, no `spec.json`) | 要求新規作成 |
| Existing spec, requirements change | 要求更新 |
| Requirements generated, design-only change | 設計更新 |
| No spec change, implementation only | **Not an orchestration flow** — stop; `/sdd-impl <feature>` |
| Path B (no spec, decided by discovery) | 直接実装 (outside orchestration) |

**User override wins** — e.g.「要求だけ更新」「設計だけ」. 「実装のみ」「実装だけ」 is a redirect to `/sdd-impl`, not an override into an orchestration flow.

## Modification Guard (implementation must be complete first)

**The orchestrator must not modify a spec whose implementation is not yet complete.** Before entering any flow that changes an existing spec (要求更新 / 設計更新, or a Path A extension into an existing spec), gate on that spec's implementation state.

Read `docs/specs/<feature>/spec.json` + `tasks.md`:

| State | Meaning | Orchestrator action |
| ----- | ------- | ------------------- |
| `ready_for_implementation: true` **and** `tasks.md` has any `[ ]` or `_Blocked:_` | implementation-ready but **not** complete | **Stop. Do not modify.** Prompt user to finish implementation first (`/sdd-impl <feature>`). |
| `ready_for_implementation: true` **and** all `tasks.md` tasks `[x]`, no `_Blocked:_` | implementation complete | Modification allowed — proceed with 要求更新 / 設計更新 |
| `ready_for_implementation: false` | still in first-pass authoring (requirements/design/tasks not finished) | Not a modification of implemented-ready work — resume the initial flow normally |

- "Implementation complete" = `tasks.md` exists, every task `[x]`, none `_Blocked:_` (`/sdd-spec-status <feature>` → `IMPLEMENTATION_COMPLETE`; a prior `/sdd-validate-impl` GO is stronger evidence).
- On a blocked modification, report: which spec, its outstanding `[ ]` / `_Blocked:_` tasks, and instruct: complete implementation via `/sdd-impl <feature>`, then re-request the change.
- **User override does not bypass this guard** unless the user explicitly acknowledges the incomplete implementation and insists on modifying anyway.
- Path B (直接実装) is unaffected — it has no spec.

## Upstream Dependency Guard (roadmap.md)

**The orchestrator must not start spec authoring for a downstream feature while its roadmap upstream dependencies have not finished task generation.** Before entering 要求新規作成 / 要求更新 / 設計更新 (and before each spec in Path D/E), gate on upstream readiness.

### When to run

| Flow | Timing |
| ---- | ------ |
| 要求新規作成 | At flow entry (target feature already identified from the invocation / `brief.md`), before first generation dispatch (`/sdd-spec-quick` on S, `/sdd-spec-requirements` on M/L) |
| 要求更新 / 設計更新 | After Modification Guard passes, before any generation or validate dispatch |
| Path D/E Multi-Spec | Before starting each spec's applicable flow (in roadmap dependency order) |

**Not applied** to Path B, or features with no upstream dependencies.

### Parse dependencies

Read `docs/steering/roadmap.md` when it exists:

- `## Specs (dependency order)`
- `## Existing Spec Updates` (if present)

Find the line for the target feature; parse the `Dependencies:` field (comma-separated spec names; `none` = no deps).

| Condition | Action |
| --------- | ------ |
| `roadmap.md` missing | Pass (single-spec / no roadmap context) |
| Feature not listed in either section | Pass |
| `Dependencies: none` (or empty) | Pass |

### Upstream readiness (each listed dependency)

A dependency `<dep>` is **ready** if **any** of:

1. Its roadmap line is marked `[x]` (authoring completed for that spec), **or**
2. `docs/specs/<dep>/spec.json` has `approvals.tasks.generated === true` **and** `docs/specs/<dep>/tasks.md` exists with at least one task entry.

Otherwise **not ready** — including when `docs/specs/<dep>/` is missing or the upstream is still in requirements/design phase.

This is the same criterion as checks 1–2 of the タスクゲート (`gates.md`) applied to `<dep>` (upstream must complete before downstream starts).

### On block

**Stop.** Do not dispatch `/sdd-spec-quick`, `/sdd-spec-requirements`, `/sdd-spec-design`, `/sdd-spec-tasks`, or phase validates for the downstream feature.

Report to the user:

- Target feature and which upstream dep(s) are not ready
- Each blocking dep's status (`phase`, `approvals` from `spec.json`; optional `/sdd-spec-status <dep>`)
- Instruction: complete upstream through `/sdd-orchestrate <dep>` **in a checkout that will hold those artifacts**, then retry **this** spec in a checkout that already contains the upstream `spec.json` + `tasks.md` (typically: merge the upstream PR to the integration branch, then recreate or rebase this worktree onto that tip).
- **Do not** treat another worktree as visible. This guard reads only the current checkout. "Upstream finished next door" is not readiness.
- Independent specs (`Dependencies: none`) may run in parallel checkouts. A downstream spec must not start until every listed upstream is ready **here**.

**User override does not bypass this guard** unless the user explicitly acknowledges incomplete upstream specs and insists on proceeding anyway.

## Path → Flow

Reference mapping from the Path that `/sdd-discovery` determined **standalone** to the flow orchestration should be invoked with (Path itself is not re-derived inside orchestration — use § Entry Contract):

| Path | Route |
| ---- | ----- |
| **A** (existing spec sufficient) | 要求更新 \| 設計更新 — pick from user intent + `spec.json` approvals. No spec change → do **not** enter orchestration; `/sdd-impl <feature>` |
| **B** (no spec) | **直接実装** — never enter spec flow (handled outside orchestration) |
| **C** (new single spec) | 要求新規作成 |
| **D/E** (multi / mixed) | Run per-spec flows sequentially by dependency |

## Artifact Freshness

`approvals.*.generated` stays true across 要求更新 / 設計更新, so it cannot tell a finished phase from a stale one. Compare hashes. A hash is `sha256sum` of the file on disk. A missing hash field never counts as a match.

**Design fresh** (M/L):

- `reviews/design-review.md` has `VERDICT: GO` and Phase Gate `STATUS: VERIFIED`
- `Requirements SHA256` equals `sha256(requirements.md)`
- `Design SHA256` equals `sha256(design.md)`

**S design fresh** (tier S only; there is no `design-review.md` on the quick-path):

- `spec.json` `source_sha256.requirements_at_design` equals `sha256(requirements.md)`

The ready-true stop uses S design fresh when `complexity_tier` is `S`, and design fresh otherwise.

**Tasks fresh:**

- `approvals.tasks.generated === true`
- `tasks.md` exists and has at least one task entry
- `spec.json` `source_sha256.design_at_tasks` equals `sha256(design.md)`

**Legacy exception:** `ready_for_implementation: true` and the hash field for that side is absent (specs written before these fields). Treat that side as fresh so a completed spec is not forced back through design. The exception does not apply when ready is false, or when the field is present and does not match.

**When design is not fresh, dispatch:**

| Condition | Dispatch |
| --------- | -------- |
| `design.md` missing, or `approvals.design.generated !== true` | Resume 要求新規作成 (M/L) at `/sdd-spec-design` (full generation, then validate). Not diff-only 設計更新. |
| Design was generated and `Requirements SHA256` ≠ `sha256(requirements.md)` | `/sdd-spec-design` in diff mode, then `/sdd-validate-design-qa` |
| Requirements hash matches, but the review is missing, not `VERIFIED`, or `Design SHA256` ≠ `sha256(design.md)` | `/sdd-validate-design-qa` only |

S quick-path has no `design-review.md`. Its disk record is `spec.json` `quick_sanity` (`passed` or `follow_up`), written by `/sdd-spec-quick`.

## Spec State Hints

Apply § Artifact Freshness first. `approvals.*.generated` alone does not choose the next phase.

| Disk state | Flow |
| ---------- | ---- |
| No spec / `brief.md` only | 要求新規作成 |
| `complexity_tier` S, and the user did not ask for 要求更新 / 設計更新 / `full` | S resume (`flows.md`) |
| 要求ブロック entry table picks a step | resume 要求ブロック |
| Design not fresh | spec-design (full if design was never generated; diff if requirements moved) or validate-only, per § Artifact Freshness |
| Tasks not fresh | resume task generation |
| All fresh, `ready_for_implementation: false` | タスクゲート → Terminal auto-approve |
| All fresh, `ready_for_implementation: true` | stop; `/sdd-impl <feature>` |

If orchestration was interrupted mid-flow, the next `/sdd-orchestrate <feature>` resumes from the first stale phase — artifact-only resume per `gates.md` § Resume.

## Execution Control

- Steps run **serial** by default.
- Design validate: single `/sdd-validate-design-qa` (Pass A qa→arch→sec serial inside one skill — no parallel `design.md` writes).
- All Pass A GO before Pass B final + inline phase-gate.
- Mid-flow user pivot → re-route; resume from required step.
## Path B vs `/sdd-impl`

| | Path B 直接実装 | `/sdd-impl` |
| - | --------------- | ----------- |
| spec | none | existing |
| prerequisite | discovery Path B (standalone; never enters orchestration) | `ready_for_implementation: true` |
| implement | main context direct | `/sdd-impl` (standalone; not dispatched by this skill) |
| verify | `/sdd-verify-completion` | `/sdd-impl` review + `/sdd-validate-impl` |
