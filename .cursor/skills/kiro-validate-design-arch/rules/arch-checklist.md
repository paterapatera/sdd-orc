# Design Architecture Validate Checklist

## Mission

SOLID, loose coupling, and extensibility simulation. Architect administrator role. Runs after QA; reads QA-updated `design.md`.

Severity vocabulary, `## Reflected Fixes`, and per-check evidence discipline: shared contract (`../kiro-validate-shared/contract.md`). Every check below gets an explicit result — pass / finding / `N/A` with a one-line reason. No silent skips.

## In Scope

- Single Responsibility, dependency direction, interface boundaries
- Coupling/cohesion assessment
- Data ownership and consistency boundaries
- Alignment with steering `tech.md` / `structure.md`
- Extension scenario walkthrough
- Reflect architectural fixes into `design.md`; list every edit in `## Reflected Fixes`

## Out of Scope

- Edge-case checklist (`/kiro-validate-design-qa`)
- Security threat modeling (`/kiro-validate-design-sec`)
- User dialogue

## Anti-Pattern Scan

Explicitly scan the design for each anti-pattern and record the result:

1. **God object/module** — one component owning unrelated responsibilities
2. **Circular dependency** — components or layers referencing each other, directly or transitively
3. **Leaky abstraction** — interface exposing implementation details (storage schema, vendor types) to consumers
4. **Shared mutable state without a single owner** — two components writing the same data with no arbitration
5. **Data ownership conflict** — design's data ownership contradicts the spec's Boundary Commitments or another spec's ownership (roadmap-dependent specs)
6. **Speculative abstraction** — interfaces/adapters that exist only for hypothetical future scope with no requirement backing

## Checks

1. Components/modules have clear responsibilities; no god objects
2. Dependencies point inward; no forbidden layer violations per steering
3. Interfaces stable; implementations swappable where requirements demand flexibility
4. Shared state minimized; boundaries explicit; every mutable datum has exactly one owning component
5. Data model transactional/consistency boundaries match component boundaries (no transaction spanning ownership seams without an explicit pattern)
6. Complexity proportionate to requirements: every component, interface, and layer traces to a requirement or an explicit extensibility decision — anything else is a finding (speculative abstraction)
7. Extension simulation — walk through **two** scenarios and record whether the design absorbs each without rippling:
   - one plausible additive change derived from requirements Non-Goals or roadmap
   - one change to an external dependency (version bump, API change, replacement)

## design.md Reflection

Before `GO`:
- Split conflated responsibilities in design sections
- Add boundary/commitment clarifications
- Document dependency direction and data ownership where unclear
- Record every edit as a `## Reflected Fixes` row (finding → design.md section → summary)

## Severity (per shared contract)

- **Critical**: fundamental layering violation; unresolvable data ownership conflict; coupling that blocks a stated extensibility requirement
- **Major**: anti-pattern with a concrete fix (split, invert dependency, assign owner) → reflect it
- **Minor**: naming/boundary wording clarity

## NO-GO Triggers

- Fundamental layering violation
- Tight coupling that blocks stated extensibility requirements
- Design introduces ownership conflicts with requirements boundaries or dependent specs
