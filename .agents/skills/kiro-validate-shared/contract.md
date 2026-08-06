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
| `/kiro-validate-requirements-qa` | `requirements-qa.md` |
| `/kiro-validate-requirements-sec` | `requirements-sec.md` |
| `/kiro-validate-requirements-ex` | `requirements-final.md` |
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

## Reflected Fixes
（対象成果物を編集した validate は必須。編集なしの場合は「なし」と明記）
| Finding | 対象セクション | 修正概要 |
| ------- | -------------- | -------- |

## Evidence
（参照したファイルパス・チェック項目。各チェック項目に pass / finding / N/A(理由付き) を明示 — 黙殺禁止）
```

The orchestrator parses **`VERDICT:`** only for mechanical gate decisions.

## Severity Vocabulary (shared)

All validates classify findings with the same scale:

- **Critical**: blocks the gate — requirement contradiction/traceability break, unreviewed sensitive path, claimed-but-missing fix → `NO-GO`
- **Major**: concrete deficiency — reflect a fix into the artifact (list in `## Reflected Fixes`) or record explicit risk acceptance in `## Decisions`
- **Minor**: polish/clarity — fix allowed, note in `## Reflected Fixes`; no gate impact

## Reflected Fixes Verifiability

Every fix a validate applies to `requirements.md` / `design.md` **must** appear as a `## Reflected Fixes` row (finding → target section → summary). `/kiro-validate-requirements-ex` mechanically verifies these rows against the final `requirements.md`, and `/kiro-validate-design-ex` against the final `design.md`; unverifiable free-text fix claims are treated as missing.

## Verdict Rules

| Verdict | When |
| ------- | ---- |
| `GO` | All in-scope checks pass; artifacts exist and are consistent |
| `NO-GO` | Blocking issues require regeneration or substantive fix |
| `MANUAL_VERIFY_REQUIRED` | Missing external info the agent cannot assume |

Before declaring `GO`, confirm fresh evidence: referenced files exist, edits are written, and content is internally consistent. At **orchestrated phase gates** (要求/設計/タスク), the orchestrator applies `/kiro-verify-phase-gate` (`PHASE_GATE`) — not `FEATURE_GO`. See `phase-gate.md`.

## Phase Execution Order

**Requirements** (serial): `validate-requirements` → `qa` → `sec` → then `/kiro-validate-requirements-ex` (AI-DLC final gate)

(Supplement/documentation work is split out of the requirements phase; the post-implementation `/kiro-docs` skill handles it.)

**Design** (serial): `validate-design-qa` → `arch` → `sec` → then `/kiro-validate-design-ex` (AI-DLC final gate). Standalone interactive review: `/kiro-validate-design` (outside orchestrate flow).

Each specialist validate reflects findings into its target artifact (`requirements.md` / `design.md`) before the next step. The next validate reads the **updated** artifact.

## Update Flows

When the orchestrator indicates an update flow (not new creation), scope work to changed sections only. Do not regenerate unrelated downstream artifacts.

## Context Loading (Minimal)

Always read:
- `docs/specs/<feature>/spec.json`
- Phase inputs listed in the invoking skill

Steering: start with `docs/steering/product.md`, `tech.md`, `structure.md`. Load additional steering only when directly relevant.

Do **not** re-read this contract or sibling validate skills unless the invoking skill directs it. Per-skill I/O: `phase-contracts.md` (read only when needed).
