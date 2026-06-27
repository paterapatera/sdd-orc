# Design Architecture Validate Checklist

## Mission

SOLID, loose coupling, and extensibility simulation. Architect administrator role. Runs after QA; reads QA-updated `design.md`.

## In Scope

- Single Responsibility, dependency direction, interface boundaries
- Coupling/cohesion assessment
- Alignment with steering `tech.md` / `structure.md`
- Extension scenario walkthrough (1–2 plausible future changes)
- Reflect architectural fixes into `design.md`

## Out of Scope

- Edge-case checklist (`/kiro-validate-design-qa`)
- Security threat modeling (`/kiro-validate-design-sec`)
- User dialogue

## Checks

1. Components/modules have clear responsibilities; no god objects
2. Dependencies point inward; no forbidden layer violations per steering
3. Interfaces stable; implementations swappable where requirements demand flexibility
4. Shared state minimized; boundaries explicit
5. Complexity proportionate to requirements
6. Extension simulation: describe one additive change — does design absorb it without rippling?

## design.md Reflection

Before `GO`:
- Split conflated responsibilities in design sections
- Add boundary/commitment clarifications
- Document dependency direction where unclear

## NO-GO Triggers

- Fundamental layering violation
- Tight coupling that blocks stated extensibility requirements
- Design introduces ownership conflicts with requirements boundaries
