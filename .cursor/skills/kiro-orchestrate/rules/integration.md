# Kiro Skill Integration

Read on demand when routing, Path B, spec-init, or impl monitoring needs detail.

## Roles (dispatch only)

| Role | Responsibility | Key skills |
| ---- | -------------- | ---------- |
| 調整者 | Routing, gates, rollback | `/kiro-orchestrate` |
| プロダクトオーナー | Requirements, brush-up | spec-init, spec-requirements, validate-requirements (discovery-ex is an external pre-step, not dispatched) |
| セキュリティ管理者 | Requirements/design security | validate-requirements-sec, validate-design-sec |
| 設計者 | Design, tasks, AI-DLC design final gate | validate-gap, spec-design, validate-design-ex, spec-tasks |
| アーキテクト管理者 | SOLID, coupling | validate-design-arch |
| 品質管理者 | Edge cases, integration | validate-design-qa, validate-impl |
| 実装者 | TDD per tasks | `/kiro-impl` (or main context for Path B) |

## Spec Init

要求新規作成: `/kiro-spec-init` is the **first orchestration step** (discovery-ex already produced `brief.md` standalone). Run it even though `brief.md` exists — it reads the brief to pre-fill the project description.

| Skill | Timing | Output |
| ----- | ------ | ------ |
| `/kiro-discovery-ex` | **Standalone pre-step (before orchestration)** | Path, `brief.md` (C/D/E), `roadmap.md` (when spec deps exist) |
| `/kiro-spec-init` | Orchestration entry (要求新規作成) | `spec.json`, `requirements.md` (project description) |
| `/kiro-spec-requirements` | After init | EARS `requirements.md` body |

**Skip init** when `docs/specs/<feature>/spec.json` exists and `phase` ≥ `initialized` — resume from requirements.

## Path B (直接実装)

- Decided by `/kiro-discovery-ex` **before** orchestration; Path B work never enters an orchestration flow.
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
| `/kiro-validate-requirements` | Post-write | Semantic brush-up |
| `/kiro-validate-gap` | Req→design (optional) | Brownfield gap analysis |
| `/kiro-validate-design-qa/arch/sec` | Design | Specialist checks → `design.md` |
| `/kiro-validate-design-ex` | Design final (AI-DLC) | Synthesize 3 reports → `design-final.md`; no re-analysis |
| `/kiro-validate-design` | Standalone | Interactive review; not used in orchestrate flow |
| `/kiro-validate-impl` | Post-impl | Cross-task integration |
| `/kiro-verify-phase-gate` | Pre-approval (要求/設計/タスク) | Artifact + `VERDICT` readiness (`PHASE_GATE`) |
| `/kiro-verify-completion` | Impl loop / Path B / post-impl | Fresh evidence (`TASK`, `FIX`, `TEST_OR_BUILD`, `FEATURE_GO`) |

Validate I/O detail: `../kiro-validate-shared/phase-contracts.md`.
