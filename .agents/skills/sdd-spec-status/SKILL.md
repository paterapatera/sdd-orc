---
name: sdd-spec-status
description: Orchestrator-only. Reads a spec's artifacts and returns a structured status (phase, approvals, gate files, task completion, boundary context). Used by /sdd-orchestrate for the Modification Guard and Upstream Dependency Guard.
disable-model-invocation: true
---


# Specification Status

<background_information>
Run only from `/sdd-orchestrate` (`rules/routing.md` § Modification Guard / § Upstream Dependency Guard). `$1` is the feature to inspect (the target spec or an upstream dependency). Read-only: never edit artifacts. Report facts; the orchestrator decides the route.
</background_information>

<instructions>
## Step 1: Load Spec Context

- `docs/specs/$1/spec.json` (metadata, phase, approvals, `ready_for_implementation`, `complexity_tier`)
- List `docs/specs/$1/` for available files
- `brief.md`, `requirements.md`, `design.md`, `tasks.md` if they exist
- `brief-grill.md`, `req-grill.md` headers (`VERDICT:`, `Target SHA256`) and `reviews/*-review.md` (`VERDICT:`, Phase Gate `STATUS:`) if they exist
- `docs/steering/roadmap.md` if it exists and lists this spec

## Step 2: Analyze

- **Requirements**: count requirements and acceptance criteria
- **Design**: presence of architecture, components, and boundary sections
- **Tasks**: count `- [x]`, `- [ ]`, and `_Blocked:_` tasks
- **Gates**: grill verdicts (stale when `Target SHA256` ≠ current artifact hash), review verdicts and Phase Gate status
- **Boundary context**:
  - brief.md: `Boundary Candidates`, `Upstream / Downstream`, `Existing Spec Touchpoints` if present
  - design.md: `Boundary Commitments`, `Out of Boundary`, `Allowed Dependencies`, `Revalidation Triggers` if present
  - roadmap.md: upstream dependencies and adjacency to `Existing Spec Updates`
- **Revalidation watchlist**: downstream specs, neighboring existing-spec updates, or rollout-sensitive design notes that may need revalidation if this spec changes. Note when the spec shape looks too broad and may want roadmap/design splitting

## Return to the orchestrator

In the spec language:

```md
## Spec Status: <feature>
- EXISTS: yes | no (no → list available spec directories)
- PHASE: <spec.json phase>
- APPROVALS: requirements=<bool> design=<bool> tasks=<bool>
- READY_FOR_IMPLEMENTATION: <bool>
- COMPLEXITY_TIER: <S|M|L|missing>
- GATES: brief-grill=<verdict|stale|none> req-grill=<…> requirements-review=<verdict/status|none> design-review=<…>
- TASKS: done=<n> open=<n> blocked=<n> (none when no tasks.md)
- IMPLEMENTATION_COMPLETE: yes | no  (yes = tasks.md exists, all [x], no _Blocked:_)
- MISSING_FILES: <list>
- BOUNDARY: <upstream/downstream, out-of-boundary, allowed dependencies — short>
- REVALIDATION_WATCHLIST: <short list or none>
```
</instructions>

## Safety & Fallback

- **Spec not found**: `EXISTS: no`, plus the list of directories under `docs/specs/`.
- **Incomplete spec**: list missing files under `MISSING_FILES`; do not suggest commands.
