# Design Final Gate — Synthesis Checklist

## Mission

Cross-cutting synthesis of specialist design validates. Designer role in AI-DLC. Autonomous; no user dialogue.

## In Scope

- Integrate findings from `design-qa.md`, `design-arch.md`, `design-sec.md`
- Identify up to **3** cross-cutting concerns spanning multiple domains or unresolved tensions between reports
- Confirm final `design.md` is consistent with specialist reflections and requirements traceability
- Record synthesis decisions and accepted residual risks in `## Decisions`
- Write `reviews/design-final.md` per shared contract

## Out of Scope

- Re-running QA edge-case checklist (`/kiro-validate-design-qa`)
- Re-running architecture review (`/kiro-validate-design-arch`)
- Re-running security threat model (`/kiro-validate-design-sec`)
- Interactive dialogue (`/kiro-validate-design` standalone path)
- Deep codebase archaeology beyond what specialist reports already cite

## Preconditions (hard stop if unmet)

1. `reviews/design-qa.md` exists with `VERDICT: GO`
2. `reviews/design-arch.md` exists with `VERDICT: GO`
3. `reviews/design-sec.md` exists with `VERDICT: GO`
4. `design.md` exists and reflects post-sec state

## Synthesis Steps

1. **Extract** — Pull open items, deferred risks, and `## Decisions` from each specialist report.
2. **Cross-check** — Look for contradictions between reports or between reports and final `design.md`.
3. **Prioritize** — Surface at most 3 cross-cutting issues (not per-domain re-audit).
4. **Decide** — `GO` if specialists passed and no blocking cross-cutting gap; else `NO-GO` or `MANUAL_VERIFY_REQUIRED`.
5. **Document** — Write `design-final.md` with Verdict, Summary, Findings (severity), Decisions, Evidence.

## Findings Severity

- **Critical**: Cross-report contradiction, requirement traceability break, specialist gap that invalidates GO → `NO-GO`
- **Major**: Residual risk needing explicit acceptance in `## Decisions` → may still `GO` if documented
- **Minor**: Synthesis note only; no gate impact

## GO Criteria

- All three specialist reports `VERDICT: GO`
- No unresolved cross-cutting contradiction
- Residual risks from specialist `## Decisions` explicitly acknowledged in synthesis `## Decisions`
- `design.md` aligns with requirements at a design-readiness level (no implementation audit)

## NO-GO Triggers

- Any specialist report missing or not `GO`
- Cross-cutting issue requires specialist re-analysis → name rollback: `validate-design-qa`, `validate-design-arch`, or `validate-design-sec`
- `design.md` contradicts adopted specialist decisions
- Cannot synthesize safely without user input → `MANUAL_VERIFY_REQUIRED`

## Update Flows

When orchestrator indicates design update (diff only): re-synthesize only findings related to changed design/requirements sections; do not re-audit unchanged specialist domains.
