# Security Requirements Validate Checklist

## Mission

Requirements-phase security review. Security administrator role. No user dialogue.

## In Scope

- AuthN/AuthZ expectations at requirements level
- PII/sensitive data handling requirements
- Compliance constraints from steering
- Trust boundaries and data flows (conceptual)
- Security-relevant AC gaps
- Record recommendations with adopt/defer rationale in `## Decisions`

## Out of Scope

- Functional scope decisions (PO validate)
- Threat model detail at design level (`/kiro-validate-design-sec`)
- Implementation-specific controls (design phase)
- User dialogue

## Checks

1. Authentication/authorization needs stated or explicitly N/A with rationale
2. PII/sensitive data identified; collection, use, retention expectations present
3. External integrations note trust boundary expectations
4. Unwanted-behavior ACs cover security-relevant failure modes where applicable
5. Steering security constraints reflected or deviation documented in `## Decisions`
6. Secrets/credentials never required in requirements text as literal values

## Decisions Format

For each security recommendation:

- **Recommendation**: what to add or clarify
- **Disposition**: adopted (requirements updated) | deferred (with risk acceptance reason)
- **Approval impact**: what fixing this in requirements commits downstream to

## NO-GO Triggers

- Undocumented handling of regulated/sensitive data
- Critical auth gap with no safe default assumption
- Contradiction with steering security mandates
