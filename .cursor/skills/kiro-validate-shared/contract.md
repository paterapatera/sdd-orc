# Validate Skill Contract (Shared)

All `/kiro-validate-*` skills in the AI-DLC flow share this contract. Read once per validate invocation.

## Autonomous Execution

- Do **not** ask the user questions during validate.
- Resolve ambiguity with reasonable assumptions; record them in `## Decisions`.
- If assumptions cannot be made safely → `VERDICT: NO-GO` or `MANUAL_VERIFY_REQUIRED`.
- Use the language specified in `spec.json`.

## Report Location

Write to `docs/specs/<feature>/reviews/<report>.md`:

| Skill | Report file |
| ----- | ----------- |
| `/kiro-validate-requirements` | `requirements-po.md` |
| `/kiro-validate-requirements-sec` | `requirements-sec.md` |
| `/kiro-validate-design-qa` | `design-qa.md` |
| `/kiro-validate-design-arch` | `design-arch.md` |
| `/kiro-validate-design-sec` | `design-sec.md` |
| `/kiro-validate-design-ex` | `design-final.md` |

Create `reviews/` if missing.

## Required Report Fields

```markdown
## Verdict
- VERDICT: GO | NO-GO | MANUAL_VERIFY_REQUIRED

## Summary
（2–3 文の要約）

## Findings
（重大度付き。NO-GO 時は修正指示を actionable に）

## Decisions
（自律的に確定した判断・前提・トレードオフ。承認ゲートでユーザーに報告する原文）

## Evidence
（参照したファイルパス・チェック項目）
```

The orchestrator parses **`VERDICT:`** only for mechanical gate decisions.

## Verdict Rules

| Verdict | When |
| ------- | ---- |
| `GO` | All in-scope checks pass; artifacts exist and are consistent |
| `NO-GO` | Blocking issues require regeneration or substantive fix |
| `MANUAL_VERIFY_REQUIRED` | Missing external info the agent cannot assume |

Before declaring `GO`, confirm fresh evidence: referenced files exist, edits are written, and content is internally consistent. At **orchestrated phase gates** (要求/設計/タスク), the orchestrator applies `/kiro-verify-phase-gate` (`PHASE_GATE`) — not `FEATURE_GO`. See `phase-gate.md`.

## Phase Execution Order

**Requirements** (serial): `validate-requirements` → `sec`

(Supplement/documentation work is split out of the requirements phase; the post-implementation `/kiro-docs` skill handles it.)

**Design** (serial): `validate-design-qa` → `arch` → `sec` → then `/kiro-validate-design-ex` (AI-DLC final gate). Standalone interactive review: `/kiro-validate-design` (outside orchestrate flow).

Each design validate reflects findings into `design.md` before the next step. The next validate reads the **updated** `design.md`.

## Update Flows

When the orchestrator indicates an update flow (not new creation), scope work to changed sections only. Do not regenerate unrelated downstream artifacts.

## Context Loading (Minimal)

Always read:
- `docs/specs/<feature>/spec.json`
- Phase inputs listed in the invoking skill

Steering: start with `docs/steering/product.md`, `tech.md`, `structure.md`. Load additional steering only when directly relevant.

Do **not** re-read this contract or sibling validate skills unless the invoking skill directs it. Per-skill I/O: `phase-contracts.md` (read only when needed).
