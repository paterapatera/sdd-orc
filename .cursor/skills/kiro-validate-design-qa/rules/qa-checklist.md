# Design QA Validate Checklist

## Mission

Abnormal flows and edge-case coverage check. Quality administrator role. Reflect fixes into `design.md`.

## In Scope

- Error paths, boundary conditions, empty/null states
- Concurrency/race scenarios when relevant
- Idempotency and retry behavior
- Input validation edge cases
- Failure-mode handling aligned with requirements Unwanted Behavior ACs
- Checklist-style findings; update `design.md` for gaps

## Out of Scope

- Architecture/SOLID review (`/kiro-validate-design-arch`)
- Threat model (`/kiro-validate-design-sec`)
- User dialogue

## Checks

1. Map each Unwanted Behavior AC to design coverage (table in Evidence)
2. Happy path does not silently assume impossible preconditions
3. Error handling specified for external dependency failures
4. State-driven requirements have invalid-transition handling
5. Pagination/limits/timeout edge cases addressed when NFRs imply them
6. Test strategy section mentions edge-case verification (if design template has it)

## design.md Reflection

Before `GO`, apply actionable fixes to `design.md`:
- Add missing error/edge handling sections
- Clarify ambiguous behavior under failure
- Do not introduce architecture decisions outside design scope

## NO-GO Triggers

- Critical user-facing failure mode with no design response
- Design contradicts requirements edge-case ACs
- Repeated unfixable ambiguity after one repair pass
