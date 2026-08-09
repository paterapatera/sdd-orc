# Phase Gates

## Mechanical Gate (per validate/review)

Parse report files only — do not re-run analysis:

| Source | Parse field |
| ------ | ----------- |
| `reviews/*.md` from validate skills | `VERDICT: GO` \| `NO-GO` \| `MANUAL_VERIFY_REQUIRED` |
| `/kiro-review` | `APPROVED` \| `REJECTED` |
| `/kiro-validate-impl` | GO/NO-GO per that skill's output |

Report paths: see `../kiro-validate-shared/contract.md` (read only if parsing).

**VERDICT source (要求 / 設計):** unified `reviews/requirements-review.md` / `design-review.md` only — parse `VERDICT:` and `## Phase Gate` → `STATUS:`. Specs without the unified file are not GO (re-validate with the unified skill).

| Verdict | Orchestrator action |
| ------- | ------------------- |
| `GO` / `APPROVED` | Continue same-phase validates; when all pass → phase gate verification (below) |
| `NO-GO` / `REJECTED` | Rollback per `rollback.md` |
| `MANUAL_VERIFY_REQUIRED` | Stop; report to user until resolved |

## Phase Gate Verification (要求 / 設計 / タスク)

**要求 (unified):** After `/kiro-validate-requirements` writes `reviews/requirements-review.md` with `VERDICT: GO` and `## Phase Gate` → `STATUS: VERIFIED`, open the human approval gate. Do **not** dispatch `/kiro-verify-phase-gate` for requirements in the orchestrated flow (standalone re-check still allowed).

**設計 (unified):** After `/kiro-validate-design-qa` writes `reviews/design-review.md` with `VERDICT: GO` and `## Phase Gate` → `STATUS: VERIFIED`, open the human approval gate. Do **not** dispatch `/kiro-verify-phase-gate` for design in the orchestrated flow.

**タスク:** After generation, **before** terminal auto-approve:

1. Dispatch `/kiro-verify-phase-gate <feature> tasks`
2. Parse `STATUS: VERIFIED` | `NOT_VERIFIED` | `MANUAL_VERIFY_REQUIRED` (claim type `PHASE_GATE`)
3. Checklist: `../kiro-validate-shared/phase-gate.md`

| Result | Orchestrator action |
| ------ | ------------------- |
| `VERIFIED` | **Terminal auto-approve** (below) — do **not** open a human approval prompt |
| `NOT_VERIFIED` | Do **not** auto-approve; rollback per `rollback.md` § Phase gate failures |
| `MANUAL_VERIFY_REQUIRED` | Stop; report gaps to user |

**Do not** use `/kiro-verify-completion` with `FEATURE_GO` for 要求 / 設計 / タスク — that claim type is for post-impl feature completion only. Inside `/kiro-impl`, use `BATCH` at each batch/selection completion gate (or `TASK` only for a single manual task); use `FEATURE_GO` only after `/kiro-validate-impl` GO at **[GATE] 実装**. Do **not** require verify-completion after every intermediate `APPROVED` while batch tasks remain unmarked.

## Phase Gate Table (`spec.json`)

| Phase | Pass condition | After readiness |
| ----- | -------------- | ------------------- |
| 要求 | `requirements.md` + `/kiro-validate-requirements` GO + Phase Gate VERIFIED (`requirements-review.md`) | On **`go`**: `approvals.requirements.approved: true` → **Phase Handoff → end**（`/kiro-spec-design` は**次の新規セッション**で） |
| 設計 | `design.md` + `/kiro-validate-design-qa` GO + Phase Gate VERIFIED (`design-review.md`) | On **`go`**: `approvals.design.approved: true` → **Phase Handoff → end**（`/kiro-spec-tasks` は**次の新規セッション**で） |
| タスク | `tasks.md` generated + `/kiro-verify-phase-gate` VERIFIED | After **auto-approve**（人間プロンプトなし）: `approvals.tasks.approved: true`, `ready_for_implementation: true` → **end orchestration (do not dispatch `/kiro-impl`)** |
| 仕様一式 (S) | `requirements`/`design`/`tasks` generated + sanity review (or unified validates GO) | After **auto-approve**（人間プロンプトなし）: all three `approvals.*.approved: true`, `ready_for_implementation: true` → **end orchestration** |
| 実装 | (out of orchestration scope) | On **`go`**: continue / end per `実装のみ` — reached only via an explicit `実装のみ` invocation（**not** Phase terminal） |

Requirements validate: single `/kiro-validate-requirements` (unified). Design validate: single `/kiro-validate-design-qa` (unified). Interactive `/kiro-validate-design` is outside orchestrate.

## Phase terminal（人間ゲート後）

| 用語 | 意味 |
|------|------|
| **Phase terminal** | 要求 or 設計の人間承認直後。`approvals.<phase>.approved: true` を書いたら、**同一 invocation では次フェーズのスキルを dispatch しない**。Phase Handoff を出して終了する |
| **Resume** | ユーザーが**新しいチャット**で `/kiro-orchestrate <feature>` を実行。Entry Contract / Spec State Hints が次フェーズを選ぶ。**Artifact-only resume**: handoff・`spec.json`・`docs/specs/<feature>/` 成果物（および steering）だけを信頼し、前チャット履歴・口頭合意・未書き込みの決定は前提にしない |
| **Terminal auto-approve** | 現行どおり（タスク / 仕様一式）。変更しない |

**実装ゲート（`[GATE] 実装`）は Phase terminal にしない**（`実装のみ` フロー内の承認のまま）。

## Human Approval Gate

Open only for **要求** / **設計** / **実装** — after requirements/design unified Phase Gate `VERIFIED`, or `/kiro-verify-completion` returns verified (`FEATURE_GO` at **[GATE] 実装** only). Do **not** open for タスク or 仕様一式 (those use **Terminal auto-approve** below). Report:

1. Current phase + completed validates
2. Key artifact paths
3. **決定事項サマリー** — summarize each report's `## Decisions` as: 何を決めたか / なぜ / 承認で固定されること。承認で固定する内容は成果物／review に既に書かれているものに限る。チャットだけの決定を承認対象にしない（あるなら先に成果物へ落とす）。

   要求 / 設計 gates: the unified report (`reviews/requirements-review.md` / `reviews/design-review.md`) already contains the 承認ゲートサマリ (検証済み観点 / 自己修復 / 残リスク / 未決事項) — present it as the primary gate content and ask the user to accept the listed residual risks; do not re-summarize the specialist summaries beyond it.

   Topics to cover when present:

   | Topic | Examples |
   | ----- | -------- |
   | Scope | in/out of scope, implicit assumptions |
   | Requirements validates | PO defaults, resolved ambiguity, testability fixes (`reviews/requirements-review.md`) |
   | Security validates | adopted controls, deferred risks |
   | Supplements | glossary/boundary interpretation |
   | Design | architecture choices, threat-model assumptions (`reviews/design-review.md`) |

   Detail lives in `reviews/*.md` where present; gate report stays concise.
4. Open issues (if any)
5. Approval request — always include: `Reply: go (approve & end) | fix <notes>`
   - **要求 / 設計**: `go` = approve & Phase terminal (handoff → end)
   - **実装**: `go` = approve & continue / end the `実装のみ` flow（**not** Phase terminal; input vocabulary is the same）

### Gate commands (`go` / `fix`)

Latin-letter phrases only (IME-free). Japanese phrases are **not** canonical commands.

| User input | Meaning | Action |
|------------|---------|--------|
| **`go`** | Approve this phase | **要求 / 設計:** `approvals.<phase>.approved: true` → Phase Handoff → **end**. **実装:** set approval per existing convention → continue / end per flow（**not** Phase terminal） |
| **`fix`** | Reject / continue editing | Do **not** set `approved`. Follow notes in the same or following message; stay in the same phase |

**Normalization** (apply to 要求 / 設計 / 実装 gates):

- Case-insensitive: `go` / `GO` / `Go` are the same
- Trim surrounding whitespace. Accept when the whole message is the command, or when the leading token is the command (e.g. `go` / `fix: AC-3 を明確化` / `fix\n...`)
- **No aliases** (`ok` / `yes` / `承認` / Japanese approval phrases are not commands). On invalid input, prompt: `go` または `fix` を送ってください
- Gate prompt must include: `Reply: go (approve & end) | fix <notes>`

### On `go` (要求 / 設計)

1. Set `approvals.<phase>.approved: true`（要求 → `requirements`, 設計 → `design`）
2. Update existing meta such as `phase` if the current convention already does（no new required `spec.json` fields）
3. Emit **Phase Handoff**（below）
4. **End orchestration** — do **not** dispatch the next `/kiro-spec-*` in the same conversation

### On `fix` (要求 / 設計 / 実装)

Do not approve. Process correction notes in the same phase (same as today's edit loop).

### Rules

- **No next phase without `go`.** For 要求 / 設計: after `go`, also **do not** continue to the next phase in the **same session** — resume in a new chat. (`-y` fast-track only if user explicitly requests; see § Exceptions.)
- **設計 → タスク** is Phase terminal the same way as 要求 → 設計. Do **not** keep design→tasks in one conversation while cutting only requirements.
- Path B: no `spec.json` gates — user confirmation at end only.
- Terminal タスク / 仕様一式: use **Terminal auto-approve** — never open a human `go`/`fix` prompt for these steps.

### Phase Handoff（必須フォーマット）

After `go` on 要求 or 設計, emit one copy-friendly block in the chat. Language follows the spec (default ja). Distinct from **PR Summary Output** (tasks terminal).

**Required items:**

1. **終了したフェーズ** — `requirements` | `design`
2. **feature** — `<feature>`
3. **次にやること** — 新しいチャットを開き、次を実行: `/kiro-orchestrate <feature>`
4. **routing が選ぶ次フロー**（例）:
   - 要求承認後 → 設計フェーズ（`設計更新` or 要求新規作成の設計ステップ相当）
   - 設計承認後 → タスク生成（`/kiro-spec-tasks` まで）
5. **読む成果物**（パス列挙）:
   - 要求終了時: `docs/specs/<feature>/spec.json`, `requirements.md`, `reviews/requirements-review.md`（あれば `brief.md`）
   - 設計終了時: 上記 + `design.md`, `reviews/design-review.md`（あれば `research.md`）
6. **残リスク 1〜3 行** — 当該 unified review の受容残リスクから要約（再分析しない）
7. **禁止** — 「このチャットの続きで設計／タスクを続けないでください」（短い一文）

**Template** — emit as a single fenced ` ```markdown ` block (fill paths for the ended phase; omit N/A lines):

````markdown
```markdown
## Phase Handoff

- **終了したフェーズ**: <requirements|design>
- **feature**: <feature>
- **次にやること**: 新しいチャットで `/kiro-orchestrate <feature>`
- **routing が選ぶ次フロー**: <設計フェーズ | タスク生成>
- **読む成果物**:
  - `docs/specs/<feature>/spec.json`
  - `docs/specs/<feature>/requirements.md`
  - `docs/specs/<feature>/reviews/requirements-review.md`
  - （要求終了時・あれば）`docs/specs/<feature>/brief.md`
  - （設計終了時）`docs/specs/<feature>/design.md`
  - （設計終了時）`docs/specs/<feature>/reviews/design-review.md`
  - （設計終了時・あれば）`docs/specs/<feature>/research.md`
- **残リスク**:
  - <1〜3 lines from unified review>
- **禁止**: このチャットの続きで設計／タスクを続けないでください
```
````

### Exceptions（切断しない）

| ケース | 振る舞い |
|--------|----------|
| **S / quick-path** | 現行どおり 1 dispatch で要求+設計+タスク → Terminal auto-approve。Phase terminal なし |
| **`-y` fast-track** | ユーザー明示時のみ、要求→設計→タスクを**同一会話で連鎖してよい**（コストより速度）。handoff 省略可 |
| **フェーズ内**（例: requirements 生成 → validate → ゲート前の修正往復） | **同一会話のまま**（切らない） |
| **validate NO-GO → rollback 再生成** | 同一フェーズ内。切らない |
| **`[GATE] 実装`** | Phase terminal にしない。入力語彙だけ `go`/`fix` |

### Terminal auto-approve (タスク / 仕様一式)

After mechanical readiness (below), the orchestrator **auto-approves** without opening a human approval prompt:

**M/L — after tasks:**
1. `/kiro-spec-tasks` completed; `approvals.tasks.generated === true`
2. `/kiro-verify-phase-gate <feature> tasks` → `STATUS: VERIFIED`
3. **[調整者]** set `approvals.tasks.approved: true`, `ready_for_implementation: true`, `phase: tasks-approved`
4. Emit **PR Summary Output**
5. End orchestration (do **not** dispatch `/kiro-impl`)

**S — after quick-path:**
1. `/kiro-spec-quick --auto --from-orchestrate` succeeded; all three `approvals.*.generated === true`
2. Sanity review (and optional unified validates) GO as required by quick-path contract
3. **[調整者]** set all three `approvals.*.approved: true`, `ready_for_implementation: true`, `phase: tasks-approved`
4. Emit **PR Summary Output**
5. End orchestration (do **not** dispatch `/kiro-impl`)

Do **not** open a human `go`/`fix` prompt for these terminal steps. User can still edit `tasks.md` / re-orchestrate later if needed.

### Complexity tier gate counts

| Tier | Human gates | Notes |
| ---- | ----------- | ----- |
| **S** | **0** | quick-path success → Terminal auto-approve (S) + PR Summary |
| **M** | **2**（要求・設計） | タスクは再開後に自動; 各ゲート後は Phase terminal |
| **L** | **2**（要求・設計） | タスクは再開後に自動; 各ゲート後は Phase terminal |
| missing `complexity_tier` | **2** | Treat as L (backward compatible). |

`実装のみ` is unchanged by tier (one **[GATE] 実装** human gate only; not Phase terminal).

## [AUTO] 仕様一式 (S-tier only)

Terminal auto-approve checklist covering requirements, design, and tasks (no human prompt).

Precondition:

- `spec.json` `approvals.*.generated === true` for all three phases
- Sanity review or unified validate reports `VERDICT: GO`

On auto-approve (**[調整者]**):

- `approvals.requirements.approved: true`
- `approvals.design.approved: true`
- `approvals.tasks.approved: true`
- `ready_for_implementation: true`
- `phase: tasks-approved`

Then: PR Summary Output → orchestration ends. Do **not** dispatch `/kiro-impl`.

## PR Summary Output (タスク生成完了時)

After **terminal auto-approve** (`approvals.tasks.approved: true`, `ready_for_implementation: true`), and **before** ending the orchestration, emit a Pull Request-ready summary so the user can copy & paste it directly into a PR (title + description).

**Format rules**

- Output as a single fenced ` ```markdown ` code block so it copies cleanly into a PR.
- Language follows the spec artifacts (default Japanese).
- Content is synthesized from the phase reports (`reviews/*.md` — especially `## Decisions` and 承認ゲートサマリ / `### 受容が必要な残リスク`), `brief.md` / `requirements.md`, `design.md`, and `tasks.md` — do not re-run analysis, only parse existing artifacts.
- Keep it concise; detail stays in the spec files.

**Required content**

1. **タイトル** — one-line PR title (not a heading inside the body). Synthesize from `<feature>` + brief/requirements scope: short, imperative or noun-phrase, no trailing period. Prefer `<feature>: <要約>` (or repo PR title convention if one exists).
2. **概要** — what this spec/feature delivers (scope in a few sentences), spec path `docs/specs/<feature>/`.
3. **決定事項と理由 一覧** — a table of every key decision with its rationale, aggregated across phases:

   | 決定事項 | 理由 |
   | -------- | ---- |
   | <何を決めたか> | <なぜそう決めたか> |

   Aggregate the same topics as the 決定事項サマリー (Scope / Requirements validates / Security validates / Supplements / Design / Tasks). One row per decision.
4. **残リスク** — residual risks accepted at 要求/設計 gates (and any still listed at terminal). Aggregate from unified reports' `### 受容が必要な残リスク` (and equivalent Decision bullets on deferred risks) in `reviews/requirements-review.md` / `reviews/design-review.md` (fall back to `*-final.md` / specialist reports if unified file is absent). Include risk + why accepted / deferred. If none: write `なし`.

**Template**

````markdown
```markdown
タイトル: <feature>: <要約>

## 概要

<feature が実現すること / スコープ>
Spec: `docs/specs/<feature>/`

## 決定事項と理由

| 決定事項 | 理由 |
| -------- | ---- |
| … | … |

## 残リスク

| リスク | 受容 / 延期の理由 |
| ------ | ---------------- |
| … | … |
```
````

## Impl Phase Monitoring

Delegate to `/kiro-impl`; monitor stop conditions:

- All tasks `[x]` before `/kiro-validate-impl`
- `_Blocked:_` tasks → stop, report user
- Batch / selection loop: implement → parent mechanical → `/kiro-review` (judgment) → `/kiro-verify-completion` (`BATCH` / single-task `TASK`) before `[x]` (impl skill owns detail; execution mode `direct` / `wave` / `strict` from `complexity_tier`)

## Brownfield Option

`/kiro-spec-design` runs inline gap analysis on brownfield only (writes `research.md`). Greenfield skips gap — no separate gap dispatch.
