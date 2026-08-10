# Dependency gate, spec deletion, roadmap update

Preconditions and post-processing (deletion / roadmap update) for `/kiro-docs`.

## Preconditions (pre-run checks)

Before creating documents, confirm all of the following. If any fails, **stop** and report the reason to the user.

### 1. Implementation-complete check

- Read `docs/specs/<feature>/spec.json`.
- Read `docs/specs/<feature>/tasks.md`.
- Confirm:
  - All tasks are `[x]` (no unstarted `[ ]` remain)
  - No `_Blocked:_` tasks exist
  - Approved (`ready_for_implementation: true` and a state equivalent to implementation-phase completion)
- If incomplete, stop: report "implementation is not complete, so `/kiro-docs` cannot run; finish implementation first".

### 2. Upstream dependency check (roadmap.md)

- Read `## Specs (dependency order)` (and `## Existing Spec Updates`) in `docs/steering/roadmap.md` and parse each spec's `Dependencies:`.
- Identify the target spec's **upstream dependencies = the specs listed in the target spec's `Dependencies:`**.
- If any of those upstream dependencies **still exist as `docs/specs/<dep>/`**, this run is **not allowed** — stop.
  - Example report: "`<feature>` cannot run because its upstream dependencies `<dep1>, <dep2>` are unprocessed (not deleted). Process the upstream specs with `/kiro-docs` (document + delete) first, then retry."
- If all upstream dependencies are already resolved (absent from roadmap, or their directories deleted), pass.
- If `roadmap.md` does not exist, you may treat this as a single-spec case and pass (but user confirmation before deletion is still required).

> Dependency direction: `Dependencies: A` means "this spec depends on A (A is upstream)". Processing goes **from upstream to downstream**. Deleting an upstream spec and updating roadmap dependencies clears the downstream specs' upstream, enabling the next `/kiro-docs` run.

## Deletion

1. Run only after documents are created and the user has confirmed the content is acceptable.
2. **Deletion notice**: list the spec director(ies) to be deleted (e.g. `docs/specs/<feature>/`) and **announce them to the user beforehand**. When multiple specs are targeted, list all of them.
3. Delete the target spec director(ies) only after the user's explicit approval.
4. If approval is not given or is unclear, do not delete.

### What may be deleted

Only **`docs/specs/<feature>/`** (the target feature directory). Nothing else.

### Deletion-prohibited paths

Never delete any of the following (feature cleanup must not touch persistent contracts or shared docs):

- `docs/architecture/**`
- `docs/contracts/**`
- `docs/architecture/adr/**`
- `docs/specs/_shared/**` — merge/update of files is allowed; **directory (or wholesale) deletion is forbidden**

Do not "clean up" architecture, contracts, or ADRs as part of spec deletion.

### Pre-deletion check (recommended)

When presenting the deletion notice for user confirmation, if the target feature's `design.md` Persistent References lists any `modify` entries:

1. Lightly verify that the corresponding `docs/contracts/**` or ADR path still exists.
2. If missing, **warn** the user (do not hide the gap).
3. After user confirmation, proceed with deletion as usual — the warning does not block deletion.

## Roadmap update (after deletion)

Once spec deletion is complete, update `docs/steering/roadmap.md`.

1. Remove the deleted spec's line from `## Specs (dependency order)` (and `## Existing Spec Updates` if applicable).
2. Remove the deleted spec from the remaining specs' `Dependencies:`.
   - If a dependency list becomes empty, replace it with `Dependencies: none`.
3. Preserve the notation (`- [ ] name -- desc. Dependencies: ...`) and consistency with other sections. Do not break the format `/kiro-spec-batch` parses.
4. After updating, report the changes (deleted spec, specs whose dependencies changed) to the user.

### Example

Before:

```
## Specs (dependency order)
- [x] auth -- Authentication foundation. Dependencies: none
- [x] order -- Order feature. Dependencies: auth
- [ ] report -- Aggregation. Dependencies: auth, order
```

After processing (documenting + deleting) `auth`:

```
## Specs (dependency order)
- [x] order -- Order feature. Dependencies: none
- [ ] report -- Aggregation. Dependencies: order
```
