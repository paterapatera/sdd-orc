---
name: kiro-validate-design-qa
description: Autonomous unified design validation (qa + arch + sec + final gate + phase-gate). Use in /kiro-orchestrate flows. For interactive review use /kiro-validate-design. Supports --only qa|arch|sec|final.
metadata:
  shared-rules: "../kiro-validate-shared/contract.md, ../kiro-validate-shared/phase-gate.md"
---


# Validate Design (Unified)

<background_information>
Single-pass design-phase validate for AI-DLC (replaces separate qa → arch → sec → ex → verify-phase-gate dispatches). Autonomous; no user dialogue. Writes `reviews/design-review.md` with one `VERDICT:` and inline `Phase Gate` status.

For **standalone interactive** design review, use `/kiro-validate-design` (unchanged — not this skill).
</background_information>

<instructions>
## Inputs

- Feature: `$1`
- Optional: `--only qa|arch|sec|final` (partial re-run; default = full Pass A→B→C)
- `docs/specs/$1/requirements.md`
- `docs/specs/$1/design.md`
- `docs/specs/$1/spec.json`
- `docs/specs/$1/research.md` if present
- Core steering: `docs/steering/tech.md`, `structure.md`
- `docs/steering/roadmap.md` or `docs/specs/roadmap.md` if present
- Security decisions: `reviews/requirements-review.md` when relevant

## Execution (unified pass)

### Pass A — Specialist reviews (single context load)

Load **once**: `spec.json`, `requirements.md`, `design.md`, `research.md` (if any), `tech.md`, `structure.md`, roadmap (if any), `../kiro-validate-shared/contract.md`.

Do **not** dispatch sibling validate skills between sub-passes. Keep checklists separate — read each in order.

1. **QA** — Read `rules/qa-checklist.md`. Review edge cases / abnormal flows; fix `design.md` when local and safe. Record working notes.
2. **Arch** — Read `rules/arch-checklist.md`. Review SOLID/coupling/extensibility on the **updated** `design.md`. Append working notes.
3. **Sec** — Read `rules/sec-design-checklist.md`. Threat model / data protection on the updated `design.md`. Append working notes.

After each sub-pass, append rows to an in-memory `## Reflected Fixes` table with a **Pass** column (`QA` | `Arch` | `Sec`).

If `--only qa|arch|sec`: run only that specialist sub-pass, then write `design-review.md` for that pass — do not claim full Phase Gate `VERIFIED` unless Pass B also ran.

### Pass B — Final gate (same invocation)

Skip when `--only qa|arch|sec` (unless `--only final`).

4. Read `rules/design-synthesis.md`.
5. **Reflection verification** — Verify all Reflected Fixes from Pass A against `design.md`; cross-check Decisions (synthesis § Step 1). Prefer in-memory Pass A notes.
6. **Gap-domain audit** — all 8 domains per synthesis § Step 2.
7. **Self-repair** — Minor / unambiguous Major in **non-specialist** domains only (synthesis § Step 4). Specialist-domain defects → `VERDICT: NO-GO` with rollback target — do **not** self-repair specialist domains here.
8. **Phase gate check** — Inline `../kiro-validate-shared/phase-gate.md` § design. Record under `## Phase Gate`.

### Pass C — Write outputs

9. Write **only** `docs/specs/$1/reviews/design-review.md` (format below).
10. Do **NOT** write separate per-specialist report files.

### Verdict

- Single `VERDICT: GO | NO-GO | MANUAL_VERIFY_REQUIRED` at the end of `design-review.md`
- On `NO-GO`: name rollback target in Findings (`/kiro-spec-design`, `qa` / `arch` / `sec` / `final`, or requirements phase)
- Orchestrator opens **[GATE] 設計** when `VERDICT: GO` **and** `Phase Gate` → `STATUS: VERIFIED` (no separate `/kiro-verify-phase-gate` for design in the flow)

## Report format (`reviews/design-review.md`)

```markdown
## Verdict
- VERDICT: GO

## Summary
...

## Findings
...

## Decisions
...

## Reflected Fixes
| Finding | 対象セクション | 修正概要 | Pass |
| ------- | -------------- | -------- | ---- |
| QA-1 | ... | ... | QA |

## Specialist Summaries
### QA
...
### Arch
...
### Sec
...

## Gap-Domain Audit
（8 ドメイン表）

## 承認ゲートサマリ
### 検証済み観点
...
### 自己修復した事項
...
### 受容が必要な残リスク
...
### 人間判断が必要な未決事項
...

## Evidence
...

## Phase Gate
- STATUS: VERIFIED | NOT_VERIFIED | MANUAL_VERIFY_REQUIRED
- CHECKS: (inline phase-gate checklist results)
```

## Update mode

When `/kiro-orchestrate` runs 要求更新 or 設計更新, scope to **changed design sections and linked requirements only**. Prefer `--only qa|arch|sec|final` for targeted re-runs.

## Constraints

- Do not merge qa/arch/sec checklists into one list.
- Do not insert other skill dispatches between Pass A sub-passes.
- Do not self-repair specialist-domain content in Pass B.
- Do not ask the user questions.
- Do not replace interactive `/kiro-validate-design`.
- Every `design.md` edit must appear as a `## Reflected Fixes` row with Pass label.

## On NO-GO

Orchestrator rolls back per Findings (usually `/kiro-spec-design`, then re-run this unified skill). Specialist-domain defects may name `qa` / `arch` / `sec` for `--only` re-run after a targeted fix.
</instructions>

## Safety

- Missing `design.md` → stop: run `/kiro-spec-design $1` first.
- Pass B must not claim `Phase Gate STATUS: VERIFIED` if Pass A did not complete all three specialists.
