# Design Final Gate — Checklist

## Mission

Final design-phase gate for AI-DLC. Designer role. Autonomous; no user dialogue.

Goal: after this gate passes, the human approval gate should require only reading the report summary and accepting documented residual risks — no independent design re-review. To achieve that, this gate (a) verifies the specialist reviews were actually reflected, (b) audits every design-quality domain the specialists do **not** cover, and (c) self-repairs `design.md` for fixable findings instead of deferring them to the human.

## In Scope

- **Reflection verification** of `design-qa.md`, `design-arch.md`, `design-sec.md` against final `design.md`
- **Gap-domain audit** — all design-quality angles outside the qa/arch/sec scopes (see § Gap Domains)
- Full requirements → design traceability matrix
- Self-repair of `design.md` for Minor and unambiguous Major findings
- Recording all decisions, self-repairs, and accepted residual risks in `## Decisions`
- Writing `reviews/design-final.md` per shared contract, with the approval-gate summary

## Out of Scope

- Re-running the QA edge-case checklist (`/kiro-validate-design-qa`)
- Re-running the architecture/SOLID review (`/kiro-validate-design-arch`)
- Re-running the security threat model (`/kiro-validate-design-sec`)
- Interactive dialogue (`/kiro-validate-design` standalone path)
- Implementation-level audit (code, tests) — this gate judges design readiness only

## Preconditions (hard stop if unmet)

1. `reviews/design-qa.md` exists with `VERDICT: GO`
2. `reviews/design-arch.md` exists with `VERDICT: GO`
3. `reviews/design-sec.md` exists with `VERDICT: GO`
4. `design.md` exists and reflects post-sec state

## Step 1 — Reflection Verification

1. From each specialist report, extract: the `## Reflected Fixes` table, open items, deferred risks, and `## Decisions`.
2. **Verify every `## Reflected Fixes` row mechanically**: for each row (finding → design.md section → summary), open the named section of the final `design.md` and confirm the fix content exists. A claimed-but-missing fix is a **Critical** finding. A report that edited `design.md` but has no `## Reflected Fixes` table (or only free-text fix claims) is itself a **Critical** finding — treat its fixes as unverified.
3. **Cross-check the three `## Decisions` sections** for contradictions with each other and with the final `design.md`. A contradiction is **Critical**.
4. Carry every deferred risk forward: each must appear in this gate's `## Decisions` as an explicitly accepted residual risk, or be resolved by self-repair.

## Step 2 — Gap Domains

Audit `design.md` against **every** domain below. Each domain gets an explicit pass/finding entry in Evidence — no domain may be silently skipped. If a domain is genuinely not applicable (e.g. no persistent data → no migration), record `N/A` with a one-line reason.

1. **Requirements traceability** — Build a full matrix: every requirement and acceptance criterion in `requirements.md` → the design element that satisfies it. Include the matrix in the report Evidence. Unmapped ACs are **Critical**; design elements with no backing requirement feed the scope check (domain 7).
2. **Non-functional (non-security)** — Performance, scalability, availability, resilience/degradation behavior. The design template requires an `Operational Readiness → Performance & Scalability` subsection: **verify** its content (or `N/A — reason`) against requirements/steering-implied NFRs. Do not author NFR content here — a wholly missing or placeholder section is a generation defect → NO-GO to `/kiro-spec-design`.
3. **Observability** — The design template requires an `Observability` section (logging with PII masking rules, metrics, alerts, debuggability). **Verify** it covers the failure modes the QA review enumerated. Do not author logging/metrics design here — it is security-reviewed upstream; a wholly missing or placeholder section is a generation defect → NO-GO to `/kiro-spec-design`.
4. **Operability** — The design template requires `Operational Readiness → Deployment & Rollout / Migration` subsections. **Verify** deployment, migration, rollback, and feature-flag content (or `N/A — reason`); any irreversible step must be identified as such. A wholly missing or placeholder section is a generation defect → NO-GO to `/kiro-spec-design`.
5. **Testability** — Every AC is verifiable as designed; test strategy covers the design's seams; no component is untestable due to hidden dependencies or missing interfaces.
6. **Compatibility** — Backward compatibility of APIs, data schemas, file formats, and contracts with other specs; impact of breaking changes stated. Every public contract (API, event, shared schema) has a versioning/evolution policy in the design or an explicit `N/A — <reason>` (e.g. internal-only, single consumer); a public contract with neither is a finding.
7. **Scope fitness** — No over-engineering beyond requirements (YAGNI) and no requirement silently dropped. Uses the traceability matrix from domain 1 in both directions.
8. **Internal & external consistency** — Terminology used consistently; diagrams match prose; data models match interface definitions; design aligns with steering (`tech.md`, `structure.md`) and with dependent/upstream specs in `docs/specs/roadmap.md` (if present).

## Step 3 — Findings (no cap)

Record **all** findings with severity. Do not limit the count.

- **Critical**: claimed-but-missing specialist fix, cross-report contradiction, traceability break (unmapped AC), gap-domain hole that blocks implementation or invalidates a specialist GO → NO-GO unless self-repairable without touching specialist domains
- **Major**: gap-domain deficiency with a concrete fix, or residual risk needing explicit acceptance → self-repair or accept in `## Decisions`
- **Minor**: polish/consistency issue → self-repair silently allowed, but still record in `## Decisions`

## Step 4 — Self-Repair Policy

Fix findings in `design.md` directly rather than deferring them to the human, within these bounds:

- **Repair**: Minor findings, and Major findings whose fix is unambiguous from `requirements.md`, steering, or the specialist reports (e.g. fix a diagram/prose mismatch, complete a traceability reference, clarify a term). Small gaps *within* existing Observability/Operational Readiness sections may be repaired only when the fix has no security relevance (no logging/PII/migration-data content).
- **Do not repair — NO-GO to `/kiro-spec-design`** when a template-required section (Observability, Operational Readiness) is wholly missing or placeholder-only: that content must be generated upstream and pass the qa/arch/sec chain, not be authored at this gate.
- **Do not repair — NO-GO with named rollback target** when the fix would require re-analysis inside a specialist domain: edge-case semantics (`validate-design-qa`), component boundaries/dependency direction (`validate-design-arch`), trust boundaries/PII/auth/logging-of-sensitive-data (`validate-design-sec`). If a self-repair would even *touch* such an area, roll back instead.
- **Do not repair — NO-GO naming the requirements phase** when the defect is in `requirements.md` itself (contradictory or untestable AC).
- After repairing, re-check the edited sections for internal consistency and confirm no specialist-domain content changed. Every repair is listed as a `## Reflected Fixes` row (finding → design.md section → summary), with rationale in `## Decisions`.

## Step 5 — Report

Write `reviews/design-final.md` with the shared-contract fields (Verdict, Summary, Findings, Decisions, Reflected Fixes, Evidence) plus a mandatory approval-gate section:

```markdown
## 承認ゲートサマリ
### 検証済み観点
（反映検証 + ギャップドメイン 1–8 の各結果を1行ずつ。N/A は理由付き）
### 自己修復した事項
（ex が design.md に加えた修正の一覧。なければ「なし」）
### 受容が必要な残リスク
（人間が受容判断すべきリスクのみ。各項目に根拠と却下時の影響）
### 人間判断が必要な未決事項
（理想は 0 件。0 件ならその旨を明記）
```

Evidence must include the full traceability matrix and the per-domain check results.

## GO Criteria

- All three specialist reports `VERDICT: GO` and every claimed fix verified present in `design.md`
- No unresolved cross-report contradiction
- All 8 gap domains checked (pass, N/A with reason, or repaired)
- Traceability matrix has no unmapped AC
- All self-repairs applied, recorded, and re-checked for consistency
- Remaining open items are **only** residual risks explicitly listed for human acceptance

## NO-GO Triggers

- Any specialist report missing or not `GO`
- Claimed specialist fix absent from `design.md`
- Finding requires specialist re-analysis → name rollback: `validate-design-qa`, `validate-design-arch`, or `validate-design-sec`
- Defect originates in `requirements.md` → name the requirements phase as rollback target
- `design.md` contradicts adopted specialist decisions
- Cannot decide safely without user input → `MANUAL_VERIFY_REQUIRED`

## Update Flows

When the orchestrator indicates a design update (diff only): run reflection verification and gap domains only against changed design/requirements sections and anything they transitively touch; rebuild the traceability matrix only for changed requirements/design sections; self-repair within the same diff scope. Do not re-audit unchanged domains or regenerate unrelated findings. The approval-gate summary still lists all 8 domains, marking unchanged ones as `unchanged (not re-audited)`.
