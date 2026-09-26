# Design review

Look once. Do not repeat the review under another role. Judge only after the mechanical checks.

Map the design as a tree. Each acceptance criterion is a settled decision. The frontier is every decision that hangs off a settled decision, whose prerequisites are already settled, and that the design has not placed. Write `GO` only when the frontier is empty: every such branch has been visited, and nothing was left silently assumed.

A branch is visited when the design places it on a boundary, a failure, a component, a file, or a decision. A recommendation whose `choose` is one way and whose `rejected` names a real alternative is visited. One observation for a result a criterion already states, recorded as `basis` `recommendation`, is visited. A mechanism or a quantity written as if the requirements had decided it, with no alternative, is silent. A status code, a deletion method, or a limit counts in any wording. Mentioning one in order to reject it is not a visit. A term or a diagram that drifts from the prose is silent. `reversible: true` on a decision that fixes how kept data is shaped or identified, picks an outside dependency or technology, changes a public contract, or needs an ADR, leaves that branch silent.

A maximum length, a spaces-only rule, a future-date ban, or a confirmation the requirements do not state is not a branch of this tree. Write `VERDICT: NO-GO` and `## Route` `- next: grill`. Do not write it into the design. Do not add a `## Boundary` `out:` for it. Do not park it under Accepted residual risks. The same route applies to a limit a human chose that the requirements do not state, and to a question that `.agents/skills/sdd-spec-requirements/rules/quality.md` derives from an element the design adds when the requirements do not settle it and the design did not mark it as a recommendation. A gap in the design itself uses `- next: design`.

A failure sentence that only repeats the screen name, or that keeps 「または」, is unvisited. The design needs one recommendation whose `choose` is a single observation of a result the criterion already states. A `## Screens` `from` line that names a place this feature does not add, with no `files` path for the change that opens the screen, is unvisited. A `depends` entry with `current` null, and with no `files` path that introduces it, is unvisited: the repository look was not recorded.

Facts are this review's. Read only the contract paths listed in `## Record`. A listed contract that contradicts the boundary is silent. Do not read contracts or ADRs that are not listed. Do not add a heading or a section the requirements do not force in order to fill a line below. Performance, availability, migration, and observability are branches only when the requirements hang them.

Under `## Evidence`, one line per domain. Each line quotes the span of the tree that was compared. `pass:` quotes a visited branch. `finding:` quotes a silent assumption. `N/A:` is only when this feature has no such branch. A missing line, a bare `pass`, a `pass` without a quote from the artifact, or an `N/A` without a reason does not finish the review. Write `MISSING` or `DRIFT` in Findings. When intent or an acceptance bar is absent from the requirements, do not fill it in the design.

QA records branches a user can observe. Arch records ownership, dependency direction, and ADRs. Sec records trust boundaries, personal data, and abuse of a public surface. One walk. Write each record under its own heading.

- `traceability` — each criterion has a place, and each design element hangs off a criterion. Both directions.
- `edges` — an input or a dependency still has a branch left assumed. Quote that branch, or quote why that input has no such branch.
- `preconditions` — the happy path assumes a state another settled branch makes impossible.
- `tests` — a stated failure has a seam. No failure behavior: `N/A`.
- `structure` — a branch has an owner, a dependency direction that follows steering, and one responsibility in its file. A second file for a responsibility an existing module already has, whose `rejected` does not name that module, is silent.
- `adr` — a decision that changes dependency direction, breaks a public contract, or adopts a technology has an ADR path under Reviewed Scope. No such decision: `N/A`.
- `surface` — a requirements branch about logs, rollout, or a public contract is placed. No such branch: `N/A`.
- `fixes` — every Reflected Fixes row is present in `design.md`. No edits: `pass` saying there were none.

`VERDICT: GO` and `## Phase Gate` `STATUS: VERIFIED` only when the frontier is empty, every Evidence line and specialist heading is filled, and Requirements SHA256 and Design SHA256 match the final files.
