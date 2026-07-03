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

## Spec Naming (domain-level)

When a flow creates a new spec, the orchestrator enforces **domain-level naming** on the `<feature>` passed to spec skills — name it after the domain / responsibility area, not a single action.

- Prefer the domain noun: `favorite`, `notification`, `billing`, `auth`.
- Do **not** encode an action/CRUD verb: avoid `favorite-add`, `favorite-edit`, `notification-send`, `user-login`.
- E.g.「ユーザーはお気に入り編集をできる」→ spec `favorite` (add/edit/delete all live inside `favorite`).
- Action-level naming only when the user explicitly asks, or a genuinely distinct domain boundary requires it.
- If a spec already owns the domain, route the new action into it (要求更新 / Path A) instead of creating an action-scoped sibling.
- If discovery proposes an action-scoped name, normalize it to the domain name before dispatching `/kiro-spec-init` / `/kiro-spec-batch` / `/kiro-spec-requirements`.

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
