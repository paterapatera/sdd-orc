# Design Security Validate Checklist

## Mission

Threat model, credentials, and PII at design level. Security administrator role. Runs after arch; reads arch-updated `design.md`.

## In Scope

- STRIDE-lite or equivalent threat enumeration for new/changed surfaces
- AuthN/AuthZ design vs requirements
- Secrets management approach (no literal secrets in design)
- PII storage, transit, logging, retention design
- Input validation and output encoding at boundaries
- Reflect security fixes into `design.md`

## Out of Scope

- QA edge-case checklist (`/kiro-validate-design-qa`)
- SOLID/architecture review (`/kiro-validate-design-arch`)
- User dialogue

## Checks

1. Trust boundaries diagrammed or described; data classification noted
2. Authentication/session/token flow defined where required
3. Authorization checks at correct layer; no security-by-obscurity
4. PII fields identified; encryption/masking/logging rules stated
5. External calls: TLS, credential injection, least privilege
6. Threat entries have mitigations or accepted risks in `## Decisions`

## design.md Reflection

Before `GO`:
- Add missing security sections/controls
- Clarify data handling at boundaries
- Document deferred risks with rationale in report `## Decisions`

## NO-GO Triggers

- Sensitive data path undocumented
- Critical threat without mitigation or accepted-risk decision
- Design contradicts requirements-sec decisions
