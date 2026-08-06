---
name: kiro-discovery-ex
description: Discovery entry point with cross-spec dependency tracking. Runs kiro-discovery, then syncs roadmap.md whenever a spec (even Path C) has a cross-spec dependency, in either direction and regardless of discovery order. Canonical standalone entry for the AI-DLC workflow; run before /kiro-orchestrate.
---

# Discovery (Extended)

<background_information>
`kiro-discovery-ex` is a **thin extension** of `kiro-discovery`. It reuses the base skill unchanged, then adds one post-step so that cross-spec dependencies are always recorded in `docs/steering/roadmap.md` — even for single-scope (Path C) work. This keeps `roadmap.md` the single machine-readable dependency source that `/kiro-orchestrate`'s Upstream Dependency Guard and `/kiro-spec-batch` already consume.

- **Success Criteria**:
  - Base discovery outcome (path, brief.md, next-command suggestion) preserved exactly
  - Any cross-spec dependency edge is reflected in `roadmap.md`, regardless of path, of which side (upstream/downstream) declared it, and of the order the two specs were discovered in
  - `roadmap.md` is created/updated additively — existing entries and `[x]` status never lost
  - No duplication of base discovery logic (delegate, don't copy)
</background_information>

<instructions>

## Step 0: Delegate to base discovery

Read `.agents/skills/kiro-discovery/SKILL.md` and execute its **Steps 1–8 in full**: lightweight scan, path determination (A–E), deep context loading, dialogue, approach proposal, refinement, file writes (`brief.md`, and `roadmap.md` for Path D/E), and next-command suggestion.

Do not re-implement or alter base behavior. Everything the base skill does still applies.

## Step E1: Dependency Resolution & Roadmap Sync

Run this **after** base discovery has written `brief.md` (and, for D/E, `roadmap.md`). This step only ever **adds or updates** roadmap entries.

Dependency detection is **bidirectional**: an edge must be recorded whether it is declared by the dependent spec (via its `Upstream`) or by the dependency spec (via its `Downstream`), and regardless of the order the two specs were discovered in. A dependency edge is always written in the canonical direction `dependent → dependency` (i.e. "dependent has Dependencies: dependency").

1. **Collect dependency edges.** Build a set of candidate edges, each oriented as `dependent → dependency`:
   - **From this session's specs.** For each spec authored or updated in this session, read the `## Upstream / Downstream` section of its `brief.md`:
     - each `Upstream` item yields the edge `thisSpec → upstreamItem`;
     - each `Downstream` item yields the edge `downstreamItem → thisSpec`.
   - **Re-scan existing specs (reverse-order catch-up).** Read the `## Upstream / Downstream` section of **every** `docs/specs/<name>/brief.md` and add the edge `<name> → upstreamItem` for each of its `Upstream` items. This is essential: a spec discovered **earlier** may have declared an upstream that did not resolve to a spec at the time, but resolves now because **this** session created that spec. Without this re-scan, discovering the dependency spec *after* its dependent (e.g. `user-edit` first, then `user-list`) would leave the edge unrecorded.

2. **Resolve to spec names.** Keep only edges where **both** endpoints resolve to a **spec**:
   - matches an existing `docs/specs/<name>/` directory, **or**
   - is another new spec produced in this same session.

   Classify every **unresolved** endpoint before discarding it — never drop silently by default:
   - **Clearly external** (an external system, library, framework, service, or infrastructure): drop silently. These are not ordering dependencies.
   - **Spec-like but unresolved** (reads like a feature/spec reference — e.g. a kebab-case concept, a bare number, or a partial name — yet matches no `docs/specs/<name>/` directory and no in-session spec): **do not drop silently. Surface it to the user as a warning** and hold the edge. Report each occurrence with its source, e.g. "`docs/specs/<dependent>/brief.md` の Upstream/Downstream にある『<endpoint>』は spec 依存に見えますが `docs/specs/` のどのディレクトリにも一致しません。正しい spec ディレクトリ名(例 `001-user-edit`)へ直すか、外部依存であることを明示してください。" Ask the user to correct the brief (or confirm it is external) before finalizing the roadmap. Never fabricate or fuzzy-guess a spec name to force a match.

   De-duplicate resolved edges (the same edge may be declared from both directions).

3. **Trigger.** If **≥ 1 edge** survives resolution:
   1. If `docs/steering/roadmap.md` is missing, create a **minimal** roadmap using the template below.
   2. For each resolved edge `dependent → dependency`, ensure a line for the **dependent** spec exists under `## Specs (dependency order)` with `Dependencies:` listing all its resolved dependency specs (comma-separated). If the line already exists, **merge the new dependency into its `Dependencies:` field in place** — never duplicate the line, never drop dependencies already listed.
   3. **Back-fill direct dependency specs only** (do not recurse into transitive dependencies): for each resolved dependency spec, add a line if absent. Mark it `[x]` if `docs/specs/<dependency>/spec.json` has `approvals.tasks.generated: true` **and** `docs/specs/<dependency>/tasks.md` exists; otherwise `[ ]`.
   4. Preserve every existing roadmap line, its `[x]`/`[ ]` status, and all other sections.

4. **No dependency.** If no edge resolves to a spec-to-spec pair (external-only, or genuinely independent), do **nothing** extra — behavior is identical to base discovery (Path C stays brief-only, no roadmap created).

## Minimal roadmap template (Path C-origin, first creation)

Use this only when `roadmap.md` does not yet exist and a Path C/A dependency triggers creation. Heavier sections (`## Approach Decision`, `## Boundary Strategy`, etc.) are written only by base discovery for genuine multi-scope work (Path D/E) — do not fabricate them here.

```
# Roadmap

## Overview
Incrementally grown from single-spec discovery. Project-level planning: TBD.

## Specs (dependency order)
- [x] <upstream-spec> -- <one-line description>. Dependencies: none
- [ ] <target-spec> -- <one-line description>. Dependencies: <upstream-spec>
```

## Step E2: Suggest Next Steps

Follow base discovery's Step 8 suggestion unchanged. If Step E1 created or updated `roadmap.md`, additionally note that the dependency was recorded so `/kiro-orchestrate` can enforce upstream readiness.

</instructions>

## Critical Constraints

- **Path classification is independent of roadmap presence.** A single-scope new spec that depends on an existing/other spec **stays Path C** and merely gains a roadmap line. Do **not** promote it to Path D/E — promotion implies multi-spec generation and would mislead `/kiro-spec-batch`.
- **Never rewrite `roadmap.md` wholesale** — append/update only, preserving completed items and prior phases (same rule as base discovery re-entry).
- **Do not copy base discovery content.** Delegate via Step 0; this skill is only the dependency-sync superset.
- **`roadmap.md` is the single dependency source.** Do not add machine-readable dependency fields to `brief.md`; briefs keep their prose `Upstream / Downstream` as human context only.

## Safety & Fallback

- Base discovery Path A/B (existing-spec extension / no-spec) still resolves upstreams: if a Path A extension references another spec as upstream, record it in `roadmap.md` the same way. Path B (no spec) never produces a roadmap line.
- If `brief.md` was not written (base discovery skipped file writes for Path A/B), skip Step E1 unless the request itself resolves to a spec dependency worth recording; when in doubt, prefer recording in `roadmap.md`.
- Circular dependency detected while updating roadmap (target lists an upstream that transitively depends on the target): stop and report the cycle instead of writing it.
