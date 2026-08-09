# Kiro Skill Integration

Read on demand when routing, Path B, requirements init, or impl monitoring needs detail.

## Roles (dispatch only)

| Role | Responsibility | Key skills |
| ---- | -------------- | ---------- |
| 調整者 | Routing, gates, rollback | `/kiro-orchestrate` |
| プロダクトオーナー | Requirements, brush-up, AI-DLC requirements final gate | spec-requirements (includes init Step 0), validate-requirements (unified; `/kiro-discovery` is an external pre-step, not dispatched) |
| セキュリティ管理者 | Requirements/design security | via unified validate-requirements / validate-design-qa |
| 設計者 | Design, tasks, AI-DLC design final gate | spec-design (inline brownfield gap), validate-design-qa (unified), spec-tasks |
| アーキテクト管理者 | SOLID, coupling | via unified validate-design-qa |
| 品質管理者 | Testability, edge cases, integration | validate-requirements (unified), validate-design-qa (unified), validate-impl |
| 実装者 | TDD per tasks | `/kiro-impl` (or main context for Path B) |

## Spec Init

要求新規作成: `/kiro-spec-requirements` is the **first orchestration generation step** (`/kiro-discovery` already produced `brief.md` standalone). Step 0 initializes `spec.json` + stub `requirements.md` when missing; then generates EARS requirements.

| Skill | Timing | Output |
| ----- | ------ | ------ |
| `/kiro-discovery` | **Standalone pre-step (before orchestration)** | Path, `brief.md` (C/D/E), `roadmap.md` (when spec deps exist) |
| `/kiro-spec-requirements` | Orchestration entry (要求新規作成) | `spec.json` (if missing) + EARS `requirements.md` body |

**Skip Step 0** when `docs/specs/<feature>/spec.json` already exists — continue from Load Context / requirements generation.

## Path B (直接実装)

- Decided by `/kiro-discovery` **before** orchestration; Path B work never enters an orchestration flow.
- No spec create/update; do not enter spec flow.
- Implement in main context — **no** `/kiro-impl` (no approved tasks).
- Verify with `/kiro-verify-completion` (`FIX` or `TEST_OR_BUILD`).
- **Not used**: `spec.json` gates, `/kiro-impl`, `/kiro-validate-impl`, mandatory `/kiro-review`.

## Impl Monitoring (`/kiro-impl`)

Per-task loop (delegate to impl skill):

1. TDD implement → `READY_FOR_REVIEW`
2. `/kiro-review` → `APPROVED` / `REJECTED`
3. On `APPROVED`: `/kiro-verify-completion` (`TASK`)
4. Mark task `[x]` in `tasks.md`
5. `REJECTED`: max 2 retries → `/kiro-debug` → `_Blocked:_` on persistent failure

Orchestrator stops if `_Blocked:_` remains or tasks incomplete before `/kiro-validate-impl`. Autonomous impl mode auto-runs validate-impl on completion.

## Validate Skill Boundaries

| Skill | Phase | Role |
| ----- | ----- | ---- |
| `requirements-review-gate` (in spec-requirements) | Pre-write | EARS mechanical + draft quality |
| `/kiro-validate-requirements` | Post-write (unified) | PO+QA+Sec+final+phase-gate → `requirements-review.md` |
| `/kiro-spec-design` | Design generation | Inline gap (brownfield) + discovery + `design.md` |
| `/kiro-validate-design-qa` | Design (unified) | QA+Arch+Sec+final+phase-gate → `design-review.md` |
| `/kiro-validate-design` | Standalone | Interactive review; not used in orchestrate flow |
| `/kiro-validate-impl` | Post-impl | Cross-task integration |
| `/kiro-verify-phase-gate` | Pre-approval (タスク; 要求/設計は統合内 or standalone debug) | Artifact + `VERDICT` readiness (`PHASE_GATE`) |
| `/kiro-verify-completion` | Impl loop / Path B / post-impl | Fresh evidence (`TASK`, `FIX`, `TEST_OR_BUILD`, `FEATURE_GO`) |

Validate I/O detail: `../kiro-validate-shared/phase-contracts.md`.
