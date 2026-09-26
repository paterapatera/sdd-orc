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
- Terms and diagrams match the prose.

Write `MISSING` or `DRIFT` in Findings. When intent or an acceptance bar is absent from the requirements, do not fill it in the design. Return NO-GO.

`VERDICT: GO` and `## Phase Gate` `STATUS: VERIFIED` only when no critical gap remains and Requirements SHA256 and Design SHA256 match the final files.
