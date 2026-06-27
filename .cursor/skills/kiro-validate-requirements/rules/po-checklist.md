# PO Requirements Validate Checklist

## Mission

Post-generation semantic review and autonomous brush-up of `requirements.md`. Product Owner role.

## In Scope

- Semantic consistency across requirements and ACs
- Ambiguity resolution with documented assumptions
- Scope clarity (in/out of scope interpretation)
- Alignment with `brief.md` and steering product context
- Terminology continuity (`Boundary Candidates` → explicit boundaries)
- Fix `requirements.md` directly when issues are local and unambiguous
- Record all autonomous decisions in report `## Decisions`

## Out of Scope

- EARS mechanical syntax checks (`requirements-review-gate` in `/kiro-spec-requirements`)
- Security deep-dive (`/kiro-validate-requirements-sec`)
- Supplement creation (`/kiro-validate-requirements-doc`)
- User dialogue

## Checks

1. Every requirement has testable ACs; no orphan objectives
2. No contradictory ACs within or across requirements
3. Ambiguous terms resolved or flagged (glossary deferred to doc validate)
4. Scope boundaries explicit where misread risk exists
5. Non-functional requirements stated at user-observable level (not implementation)
6. Requirement IDs and AC IDs follow project conventions
7. Changes to `requirements.md` preserve EARS keyword English (When, If, While, Where, shall)

## Findings Severity

- **Critical**: Contradiction, untestable core AC, scope hole → likely `NO-GO`
- **Major**: Ambiguity requiring assumption → fix + record in `## Decisions`
- **Minor**: Wording improvement → fix inline if safe

## NO-GO Triggers

- Unresolvable scope conflict between brief and requirements
- Missing core capability with no reasonable default
- Requirements structurally broken (cannot patch without regeneration)
