# Flow Routing

## Determine Active Flow

After `/kiro-discovery`, combine **Path (A–E)**, **`spec.json` state**, and **user override** to pick one flow:

| Condition | Flow |
| --------- | ---- |
| New spec / new requirements | 要求新規作成 |
| Existing spec, requirements change | 要求更新 |
| Requirements approved, design-only change | 設計更新 |
| No spec change, implementation only | 実装のみ |
| Path B (no spec) | 直接実装 |

**User override wins** — e.g.「要求だけ更新」「実装だけ」.

## Path → Flow

| Path | Route |
| ---- | ----- |
| **A** (existing spec sufficient) | 要求更新 \| 設計更新 \| 実装のみ — pick from user intent + `spec.json` approvals |
| **B** (no spec) | **直接実装** — never enter spec flow |
| **C** (new single spec) | 要求新規作成 |
| **D/E** (multi / mixed) | **No** `/kiro-spec-batch` — run per-spec flows sequentially by dependency |

## Spec State Hints

Read `docs/specs/<feature>/spec.json` metadata only when routing:

| `approvals` state | Likely flow |
| ----------------- | ----------- |
| No spec / pre-init | 要求新規作成 (Path C+) |
| requirements not approved | 要求更新 or resume requirements phase |
| requirements approved, design not | 設計更新 or resume design phase |
| tasks approved | 実装のみ |

## Execution Control

- Steps run **serial** by default.
- Design specialist validates: **qa → arch → sec** only (no parallel — `design.md` write conflict).
- All three `VERDICT: GO` before `/kiro-validate-design-ex`.
- Mid-flow user pivot → re-route; resume from required step.
- Status check → `/kiro-spec-status <feature>`.

## Path B vs 実装のみ

| | Path B 直接実装 | 実装のみ |
| - | --------------- | -------- |
| spec | none | existing |
| prerequisite | discovery Path B | `approvals.tasks.approved: true` |
| implement | main context direct | `/kiro-impl` |
| verify | `/kiro-verify-completion` | `/kiro-impl` review + `/kiro-validate-impl` |
