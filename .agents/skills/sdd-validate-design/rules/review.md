# Design review

Look once. Do not repeat the review under another role. Judge only after the mechanical checks.

A good design has all of the following:

- Each acceptance criterion traces to something in the design. No mechanism is added that no criterion needs.
- Failure, invalid transitions, dependency timeouts, duplicate submits, and limits are written where behavior changes.
- Each component's responsibility reads as one thing. Dependency direction does not contradict steering. Shared state has an owner.
- When a public surface changes, every `## Record` `contracts` path with `mode` `modify` exists and does not contradict the design boundary. Do not read contracts or ADRs that are not listed.
- Authentication, personal data, log masking, and external-call privileges match the requirements. No secret value is written.
- Performance, availability, migration, and observability are specific only when the requirements ask for them. A heading or a Record key with no fact is a gap in the design, not a section to fill.
- Reinventing an existing equivalent mechanism has a reason in `design.md`.
- `reversible` is `false` on every decision that fixes how kept data is shaped or identified, picks an outside dependency or technology, changes a public contract, or needs an ADR. A wrong `true` is a critical gap, because it skips the human's design check.
- Terms and diagrams match the prose.

Judge the domains below separately. QA judges edges, preconditions, and how failures are observed. Arch judges structure, the two extensions, and ADRs. Sec judges trust boundaries, personal data in logs, and abuse of a public surface. Write each judgment under its own heading. Do not merge the three into one list.

Under `## Evidence`, one line per domain. `pass:` quotes the span that was compared. `finding:` quotes the spot that fails. `N/A: <why this feature has nothing to compare>` is allowed only for the reason stated. A missing line, a bare `pass`, a `pass` without a quote from the artifact, or an `N/A` without a reason does not finish the review. Do not add a design section to satisfy a domain the requirements do not ask for. Record `N/A` instead.

- `traceability` — every acceptance criterion maps to a design element, and every design element maps to a criterion. Include both directions in the line.
- `edges` — for each external input and dependency, empty, malformed, oversized, duplicate submit, partial failure, out-of-order response, unavailable at startup, resource ceiling, and clock skew. A case the requirements do not mention still counts when the input or dependency exists. State where the design covers it, or why that case does not change behavior.
- `preconditions` — the happy path does not assume a state the rest of the design makes impossible.
- `tests` — each failure the design states can be observed at a seam. Name the seam. No failure behavior: `N/A`.
- `structure` — no circular dependency, no interface that exposes storage or a vendor type, no update that crosses an ownership seam without a stated pattern, no abstraction with no requirement, and no file that holds two unrelated responsibilities or splits one responsibility across unrelated files.
- `extensions` — walk two changes the requirements do not contain. Name where each one breaks, or where the current boundary absorbs it.
- `adr` — a decision that changes dependency direction, breaks a public contract, or adopts a technology has an ADR path under Reviewed Scope. A reason that no ADR is needed is `pass` and names the decision. No such decision: `N/A`.
- `surface` — logs and metrics name a masking rule where personal data can appear, deployment and rollback name any irreversible step, and a public contract names how it changes. Requirements that ask for none of these, and no public contract: `N/A`. Do not invent the section.
- `fixes` — every Reflected Fixes row is present in `design.md`. No edits: `pass` saying there were none.

Write `MISSING` or `DRIFT` in Findings. When intent or an acceptance bar is absent from the requirements, do not fill it in the design. Return NO-GO.

A choice the requirements do not determine is a recommendation: `basis` is `recommendation`, `choose` is the recommended way, and `rejected` names at least one real alternative. That is not a gap. Judge the sentence, not a token. A status code, a deletion method, or a quantity the requirements do not state is this kind of choice in any wording. Mentioning one in order to reject it is not a decision. The same choice with no alternative, or written as if the requirements had decided it, returns to the requirements. So does a limit a human chose that the requirements do not state, and a question that `.agents/skills/sdd-spec-requirements/rules/quality.md` derives from an element the design adds when the requirements do not settle it and the design did not mark it as a recommendation. Write `VERDICT: NO-GO` and `## Route` `- next: grill`. Do not fill the gap in the design, and do not park it under Accepted residual risks. A gap in the design itself uses `- next: design`.

`VERDICT: GO` and `## Phase Gate` `STATUS: VERIFIED` only when no critical gap remains, every Evidence line and specialist heading is filled, and Requirements SHA256 and Design SHA256 match the final files.
