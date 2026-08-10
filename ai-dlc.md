# AI-DLC オーケストレーション

> **一時ファイル（削除予定）**  
> 本ドキュメントは作業用のドラフトです。正本はスキル定義に移行済みのため、**近いうちに削除します**。参照・更新は次を優先してください。
>
> - オーケストレーション: `.agents/skills/kiro-orchestrate/`（`SKILL.md` + `rules/`）
> - validate 共通契約: `.agents/skills/kiro-validate-shared/`（`contract.md`, `phase-contracts.md`）
> - エントリポイント: `/kiro-orchestrate`

仕様駆動開発に基づいて開発を進めるオーケストレーション。**エントリポイント**: `/kiro-orchestrate`（`.agents/skills/kiro-orchestrate/`）

## 役割

- 調整者: フローのルーティング、フェーズゲート、巻き戻しを制御し、各役割のスキル実行をオーケストレーションする
- プロダクトオーナー: 要求の作成・自律的ブラッシュアップ、要求の総合レビュー（最終ゲート）
- セキュリティ管理者: 要求・設計段階の脆弱性、認証情報、個人情報の扱いをチェックする
- 設計者: 要求をもとに設計する、設計を元にタスクを作成する、設計の総合レビュー（最終ゲート）を行う
- アーキテクト管理者: SOLID原則、クリーンアーキテクチャの遵守。密結合を徹底排除（保守性の番人）
- 実装者: タスクを元にTDDする（`/kiro-impl` 内で実装サブエージェントとして動作）
- 品質管理者: 要求段階のテスト容易性検証、設計段階の異常系・エッジケース検証、実装完了後の feature 単位統合検証（`/kiro-validate-impl`）

## 調整者の責務

調整者は各役割の作業内容そのものを担わず、**いつ・誰に・何を実行させるか** を決め、結果に応じて前進・停止・巻き戻しを行う。

### ルーティング

ユーザーの依頼を受けたら、まず `/kiro-discovery` の結果（Path A–E）と spec の状態（`docs/specs/*/spec.json`）をもとに、下記5フローのどれを走らせるか決める。

| 条件                         | 走らせるフロー |
| ---------------------------- | -------------- |
| 新規 spec・新規要求          | 要求新規作成   |
| 既存 spec の要求変更         | 要求更新       |
| 要求は確定済み、設計のみ変更 | 設計更新       |
| spec 更新不要、実装のみ      | 実装のみ       |
| spec 不要（Path B）          | 直接実装       |

**ルーティングの判断基準**

- Discovery **Path A**（既存 spec で足りる）→ 要求更新 or 設計更新 or 実装のみのいずれかに振り分ける
- Discovery **Path B**（spec 不要）→ **直接実装フロー**（下記）。spec を経由しない
- Discovery **Path C**（新規単一 spec）→ 要求新規作成フロー
- Discovery **Path D/E**（複数 spec・混合分解）→ `/kiro-spec-batch` は使用しないで、 spec 単位でフローを分割実行
- ユーザーが明示した場合（「要求だけ更新」「実装だけ」等）は、その指示を優先する

**実行中の制御**

- 各ステップは原則 **直列**。要求フェーズの PO / QA / Sec は **`requirements.md` への反映が競合するため並列不可**。順序固定で **po → qa → sec** とし、3 レポートすべて GO 後に `/kiro-validate-requirements --only final` を **最終ゲート** として実行する
- 設計フェーズの QA / Arch / Sec は **`design.md` への反映が競合するため並列不可**。順序固定で **qa → arch → sec** とし、3 レポートすべて GO 後に `/kiro-validate-design-qa --only final` を **最終ゲート** として実行する
- フロー途中でユーザーが方針を変更した場合、調整者がルートを再判定し、必要なステップから再開する
- 進捗確認が必要なときは `/kiro-spec-status` を実行する

### ゲート

各フェーズの完了時、調整者は **機械的検証結果** を確認する。**要求・設計・実装**は続けて **人間承認** を得てから次へ進む。**タスク**（および S の仕様一式）は機械的 readiness のあと **自動承認**し、PR Summary を出してオーケストレーションを終了する。

**フェーズゲート（`spec.json` approvals）**

| フェーズ | 通過条件 | `spec.json` 更新 | 次に進めるスキル |
| -------- | -------- | ---------------- | ---------------- |
| 要求 | `requirements.md` 生成済み + `/kiro-validate-requirements` GO（`requirements-review.md` の Phase Gate VERIFIED）+ 人間承認 | `approvals.requirements.generated: true` → 承認後 `approved: true` | `/kiro-spec-design` |
| 設計 | `design.md` 生成済み + `/kiro-validate-design-qa` GO（`design-review.md` の Phase Gate VERIFIED）+ 人間承認 | `approvals.design.generated: true` → 承認後 `approved: true` | `/kiro-spec-tasks` |
| タスク | `tasks.md` 生成済み + `/kiro-verify-phase-gate` VERIFIED → **自動承認**（人間プロンプトなし） | `approvals.tasks.generated: true` → 自動で `approved: true`, `ready_for_implementation: true` | オーケストレーション終了（実装は明示的 `実装のみ`） |
| 実装 | 全タスク `[x]` + 全タスク `/kiro-review` APPROVED + `/kiro-validate-impl` GO + 人間承認 | （phase を完了状態に更新） | 終了 |

人間ゲート回数（複雑度ティア）: **S: 0** / **M: 2**（要求・設計）/ **L: 2**（要求・設計）。`実装のみ` の実装ゲートは別途 1 回。

**要求フェーズの validate 通過条件**

| スキル | 成果物 |
| ------ | ------ |
| `/kiro-validate-requirements`（統合・Pass A po→qa→sec + Pass B final + Phase Gate） | `reviews/requirements-review.md`（`VERDICT: GO` かつ Phase Gate `STATUS: VERIFIED`） |

部分再実行は `--only po|qa|sec|final`。いずれも canonical レポートは `requirements-review.md` のみ。

**設計フェーズの validate 通過条件**

| スキル | 成果物 |
| ------ | ------ |
| `/kiro-validate-design-qa`（統合・Pass A qa→arch→sec + Pass B final + Phase Gate） | `reviews/design-review.md`（`VERDICT: GO` かつ Phase Gate `STATUS: VERIFIED`） |

部分再実行は `--only qa|arch|sec|final`。いずれも canonical レポートは `design-review.md` のみ。

**人間承認の運用**

調整者は **要求・設計・実装** の機械的 validate がすべて GO になった時点で停止し、ユーザーに以下を報告する（タスク端末は自動承認のためこのプロンプトを開かない）。

1. 現在フェーズと完了した validate 一覧
2. 主要成果物のパス
3. **決定事項サマリー** — ユーザーが知らなかったでは済まされない判断・前提・トレードオフ（下記）
4. 未解決事項（あれば）
5. 承認依頼（「承認して次へ」または修正指示）

**決定事項サマリー（承認ゲートで必須）**

validate 実行中はユーザーと対話せず自律的に進める。ただし承認を求める段階では、次フェーズに進むとユーザーが事実上コミットする事項を **わかりやすく** 列挙する。

| 報告すべき事項 | 例 |
| -------------- | -- |
| スコープの含意 | in/out of scope の解釈、暗黙の前提 |
| 要求 validate で確定した判断 | PO が自律的に補った曖昧さ、採用したデフォルト |
| セキュリティ validate の推奨採否 | 採用した対策、意図的に見送ったリスクと理由 |
| 境界・契約の解釈 | 依存方向、公開面の取り方 |
| 設計・実装フェーズでも同様 | アーキテクチャ選択、脅威モデルの前提 |

書き方: 各項目を「何を決めたか」「なぜそうしたか」「承認すると何が固定されるか」の 3 点で簡潔に。詳細は `reviews/*.md` を参照可能にする。

ユーザーが承認したら、調整者（または該当スキル）が `spec.json` の `approvals.<phase>.approved: true` を更新して次フェーズへ進む。`-y` による fast-track はユーザーが明示した場合のみ（**要求・設計・実装**に限定）。タスク / 仕様一式の端末確定は常時自動承認。直接実装フロー（Path B）では `spec.json` がないため、完了時のユーザー確認のみ行う。

**validate スキルの判定**

| 判定                     | 調整者の動作                                                                   |
| ------------------------ | ------------------------------------------------------------------------------ |
| `GO` / `APPROVED`        | 同一フェーズ内の残り validate があれば続行。要求・設計は全 validate 通過後に人間承認を待つ。タスクは phase-gate VERIFIED 後に自動承認 |
| `NO-GO` / `REJECTED`     | 巻き戻し（下記参照）。次フェーズへは進めない                                   |
| `MANUAL_VERIFY_REQUIRED` | ユーザーに不足情報・手動確認事項を報告し、解消まで停止                         |

**ゲート運用ルール**

- 要求・設計・実装は人間承認なしに次フェーズへ進めない（`-y` による fast-track はユーザーが明示した場合のみ）。タスク / 仕様一式は機械的 readiness 後に自動承認
- `GO` 判定の前に各 validate スキル内で fresh-evidence を適用する。要求・設計の人間承認前、およびタスク自動承認前は phase-gate（要求/設計は統合レポート、タスクは `/kiro-verify-phase-gate`）
- 同一フェーズ内の専門 validate（要求: po / qa / sec、設計: qa / arch / sec）は、いずれかが `NO-GO` なら最終ゲート（`/kiro-validate-requirements --only final` / `/kiro-validate-design-qa --only final`）へ進めない
- `/kiro-validate-requirements --only final` / `/kiro-validate-design-qa --only final` は専門 validate の結果を入力として総合 GO/NO-GO を判定する **最終ゲート**（対話型の `/kiro-validate-design` とは別スキル）
- 人間ゲート通過時、調整者は **現在フェーズ・次ステップ・未解決事項** をユーザーに報告する。タスク自動承認直後は **PR Summary Output** を出してオーケストレーションを終了する

### 巻き戻し

validate やレビューで `NO-GO` / `REJECTED` となった場合、調整者は **原因のあるフェーズの生成ステップ** に巻き戻す。

| 失敗した validate                 | 巻き戻し先                        | 再実行                                                               |
| --------------------------------- | --------------------------------- | -------------------------------------------------------------------- |
| `/kiro-validate-requirements`     | `/kiro-spec-requirements`         | 修正後 po → qa → sec → requirements-ex の順で再 validate             |
| `/kiro-validate-requirements --only qa`  | `/kiro-spec-requirements` または `requirements.md` | 同上                                                    |
| `/kiro-validate-requirements --only sec` | `/kiro-spec-requirements` または `requirements.md` | 同上                                                    |
| `/kiro-validate-requirements --only final`  | `/kiro-spec-requirements`（専門起因なら該当 validate） | 修正後 po → qa → sec → requirements-ex の順で再 validate |
| `/kiro-validate-design-qa`        | `/kiro-spec-design`               | 修正後 qa → arch → sec → design-ex の順で再 validate                 |
| `/kiro-validate-design-qa --only arch`      | `/kiro-spec-design`               | 同上                                                                 |
| `/kiro-validate-design-qa --only sec`       | `/kiro-spec-design`               | 同上                                                                 |
| `/kiro-validate-design-qa --only final`        | `/kiro-spec-design`               | 修正後 qa → arch → sec → design-ex の順で再 validate                 |
| `/kiro-impl` 内タスク review      | 当該タスクの実装                  | 修正後 `/kiro-review` を再実行                                       |
| `/kiro-validate-impl`             | 原因タスク or 設計                | タスク単位修正 → `/kiro-impl`、設計起因なら `/kiro-spec-design` 以降 |

**巻き戻しの運用ルール**

- 巻き戻し時、調整者は **失敗理由・影響範囲・再実行ステップ** を明示する
- 要求変更が設計・実装に波及する場合、調整者は **どこまで巻き戻すか**（要求のみ / 設計まで / タスクまで）をユーザーに確認する
- 同一ステップで `NO-GO` が **2回連続** した場合、調整者は停止し、ユーザーと方針の再合意を求める
- 更新フロー（要求更新・設計更新）では、**変更差分に関係しない downstream 成果物は再生成しない**

## 既存 Kiro スキルとの接続

### `/kiro-spec-requirements`（新規 spec の初期化）

要求新規作成フローでは、discovery の直後に **必ず** `/kiro-spec-requirements` を実行する（discovery が `brief.md` を書き済みの場合も init で `spec.json` を確定する）。

| スキル | タイミング | 前提 | 成果物 |
| ------ | ---------- | ---- | ------ |
| `/kiro-discovery` | フロー開始 | なし | Path 判定、`brief.md`（Path C/D/E） |
| `/kiro-spec-requirements` | discovery 直後（Path C/D/E の新規 spec） | `brief.md` があれば読み込む | `spec.json`, `requirements.md`（プロジェクト記述のみ） |
| `/kiro-spec-requirements` | init 直後 | `spec.json` 存在 | EARS 形式の `requirements.md` 本文 |

**スキップ条件**: `docs/specs/<feature>/spec.json` が既に存在し `phase` が `initialized` 以降なら、init はスキップして requirements から再開できる。

### Path B（直接実装フロー）

Path B は spec を作成・更新しない。調整者は discovery が Path B と判定したら **直接実装フロー** に入る。

1. [調整者]: `/kiro-discovery` を実行。Path B と判定されたら spec フローには入らない
2. [実装者]: メインコンテキストで直接実装（`/kiro-impl` は **呼ばない** — tasks 承認がないため）
3. [調整者]: 完了宣言前に `/kiro-verify-completion` を適用（claim type: `FIX` または `TEST_OR_BUILD`）
4. [調整者]: 変更内容をユーザーに報告し、完了を確認

**Path B で使わないもの**: `spec.json` ゲート、`/kiro-impl`、`/kiro-validate-impl`、`/kiro-review`（タスク単位）。必要に応じて `/kiro-review` 相当の軽量チェックは調整者が手動で行ってもよいが、必須ではない。

**Path B と「実装のみフロー」の違い**

| | Path B 直接実装 | 実装のみフロー |
| - | --------------- | -------------- |
| spec | なし | 既存 spec あり |
| 前提 | discovery Path B | `approvals.tasks.approved: true` |
| 実装手段 | メインコンテキスト直接 | `/kiro-impl` |
| 完了検証 | `/kiro-verify-completion` | `/kiro-impl` 内 review + `/kiro-validate-impl` |

### 実装フェーズ内のレビュー（`/kiro-impl` + `/kiro-review`）

spec ベースの実装では、調整者は `/kiro-impl` の内部ループを把握し、feature 検証の前提が満たされているか確認する。

**`/kiro-impl` 内のバッチ／選択ループ**（調整者は impl スキルに委譲するが、停止条件を監視する）

実行モードは `spec.json` の `complexity_tier`（またはタスク数フォールバック）で `direct` / `wave` / `strict` を選ぶ（詳細は `kiro-impl` Step 2）。

1. 次 Wave／バッチ（または `direct` 選択）を組み、実装（サブエージェントまたは親）が TDD → `READY_FOR_REVIEW`
2. 親が機械チェック（テスト / TBD / Secrets / Boundary / RED）→ FAIL なら reviewer を呼ばず差し戻し
3. 通過後、レビューが `/kiro-review` で判断レビュー（バッチ／選択単位）→ `APPROVED` / `REJECTED`
4. `APPROVED` 後、`[x]` 直前に `/kiro-verify-completion` を **1 回**（claim type: `BATCH`、単一手動タスクのみ `TASK`）で fresh evidence 確認 — 中間 `APPROVED` ごとには呼ばない
5. バッチ／選択内タスクをまとめて `[x]` にし、選択的 git commit
6. `REJECTED` / 機械 FAIL は最大 2 回リトライ → 失敗時 `/kiro-debug`（fresh）→ それでも失敗なら `_Blocked:_` で停止

**調整者の関与**

- 全タスク `[x]` になるまで `/kiro-validate-impl` へ進めない
- `_Blocked:_` タスクが残ったら停止し、ユーザーに報告
- autonomous mode では impl 完了後に自動で `/kiro-validate-impl` が走る（手動 mode では調整者が明示 dispatch）
- feature 終端では `/kiro-validate-impl` GO 後に `/kiro-verify-completion`（`FEATURE_GO`）を適用する

### 既存 validate との棲み分け

| 既存スキル | フェーズ | 本フローでの位置づけ |
| ---------- | -------- | -------------------- |
| `requirements-review-gate`（`kiro-spec-requirements` 内蔵） | 要求生成**前** | 機械チェック + ドラフト品質。対話的合意は担当しない |
| `/kiro-spec-design` | 要求→設計の間（任意） | brownfield のみ。既存コードとのギャップ分析 |
| `/kiro-validate-design-qa --only final` | 設計 validate **最終（AI-DLC）** | qa/arch/sec のレポートを入力に総合 GO/NO-GO → `reviews/design-final.md`。専門分析は繰り返さない |
| `/kiro-validate-design` | 設計レビュー（**スタンドアロン**） | 対話型の独立レビュー。オーケストレートフローでは使用しない |
| `/kiro-validate-impl` | 実装完了後 | タスク横断の統合検証。バッチ／選択単位の判断レビューは `/kiro-review` の責務 |
| `/kiro-verify-completion` | 各 GO 宣言前 | fresh-evidence ゲート。調整者が各フェーズゲートと impl のバッチ／選択完了・`FEATURE_GO` で適用 |

### brownfield オプション

既存コードベースへの変更で、要求新規作成・要求更新フローの場合:

- `/kiro-spec-design` の直前に `/kiro-spec-design` を **任意挿入** できる
- 調整者はコードベース規模・既存実装の有無で判断する。greenfield ではスキップ

## スキル実装状況

### 調整者（オーケストレーター）

| スキル | パス | 概要 |
| ------ | ---- | ---- |
| `/kiro-orchestrate` | `.agents/skills/kiro-orchestrate/` | フロールーティング、フェーズゲート、巻き戻し。実行手順は `rules/` に分離（`routing`, `flows`, `gates`, `rollback`） |

### validate スキル（統合 2 本 + 対話版設計・実装済み）

共通契約: `.agents/skills/kiro-validate-shared/contract.md`（各 validate スキルから参照。重複読込み回避）

| スキル | 担当役割 | 概要 |
| ------ | -------- | ---- |
| `/kiro-validate-requirements` | プロダクトオーナー / 品質 / セキュリティ | 統合 validate（Pass A po→qa→sec + Pass B final + Phase Gate）→ `requirements-review.md`。`--only po\|qa\|sec\|final` 可 |
| `/kiro-validate-design-qa` | 品質 / アーキテクト / セキュリティ / 設計者 | 統合 validate（Pass A qa→arch→sec + Pass B final + Phase Gate）→ `design-review.md`。`--only qa\|arch\|sec\|final` 可 |
| `/kiro-validate-design` | — | 対話型スタンドアロンレビュー。AI-DLC オーケストレーションでは使用しない |

## validate スキル契約

### 共通規約

**レビューレポートの配置**

```
docs/specs/<feature>/reviews/
├── requirements-review.md  # /kiro-validate-requirements（canonical）
└── design-review.md        # /kiro-validate-design-qa（canonical）
```

新規 validate run は上記 `*-review.md` のみを生成する。旧 4+4 ファイルのみの spec は phase-gate **NOT_VERIFIED**（統合スキルで再 validate してから進む）。

**レポート必須フィールド**（各新規 validate スキルの出力）

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

調整者は `VERDICT:` フィールドのみを機械的ゲート判定に使う（`/kiro-impl` の `STATUS` / `VERDICT` パースと同様）。

**`/kiro-verify-completion` との関係**

- 各 validate スキルが `GO` を宣言する前に、スキル内で fresh evidence（ファイル存在・内容整合）を確認する
- 調整者は **要求・設計** では統合レポートの Phase Gate `STATUS: VERIFIED` を用い、オーケストレーション中は `/kiro-verify-phase-gate` を dispatch しない（タスクは `/kiro-verify-phase-gate`）
- **実装フェーズ**完了時（`/kiro-validate-impl` GO 後）は `/kiro-verify-completion`（`FEATURE_GO`）を適用する

### 要求フェーズ validate

| スキル | 入力 | 出力・副作用 | やらないこと |
| ------ | ---- | ------------ | ------------ |
| `/kiro-validate-requirements` | `requirements.md`, `brief.md`, steering | `reviews/requirements-review.md`（Specialist Summaries / Gap-Domain Audit / 承認ゲートサマリ / Phase Gate）。必要なら `requirements.md` を自律的に修正。**`## Decisions`** に判断・前提・トレードオフを記録 | EARS 機械チェック（`requirements-review-gate` の領域）、**ユーザーとの対話** |

**実行**: 単一スキル内で Pass A（po→qa→sec）→ Pass B（final + Phase Gate）→ `requirements-review.md` を書く。部分再実行は `--only po|qa|sec|final`。

**直列必須の理由**: 各専門サブパスの指摘は `requirements.md` に反映される。次のサブパスは **直前で更新された `requirements.md`** を入力とする。

**自律実行の原則**

- validate 中はユーザーに質問しない。曖昧さは合理的な前提で補い、`## Decisions` に記録する
- 前提を置けず進められない場合は `VERDICT: NO-GO` または `MANUAL_VERIFY_REQUIRED` とし、承認ゲートでユーザーに判断を委ねる（validate 中の対話は行わない）

**`requirements-review-gate` との棲み分け**

| | `requirements-review-gate`（生成前） | `/kiro-validate-requirements`（生成後） |
| - | ------------------------------------ | --------------------------------------- |
| 目的 | 書き込み前のドラフト品質・EARS 機械適合 | 生成後の意味的整合・曖昧さの自律的解消 + gap 監査 |
| 形式 | 内部ループ（最大 2 パス） | 自律実行（対話なし）。判断はレポート `## Decisions` に記録 |
| 成果物 | `requirements.md` 初版 | `reviews/requirements-review.md` + 必要な修正 |
| ユーザーへの報告 | なし（生成スキル内で完結） | **承認ゲート**で `## Decisions` / 承認ゲートサマリを要約して提示 |

### 設計フェーズ validate

| スキル | 入力 | 出力 | やらないこと |
| ------ | ---- | ---- | ------------ |
| `/kiro-validate-design-qa` | `requirements.md`, `design.md`, steering | `reviews/design-review.md`（Specialist Summaries / Gap-Domain Audit / 承認ゲートサマリ / Phase Gate）。指摘の `design.md` 反映 | 対話型レビュー（`/kiro-validate-design` の領域） |

**実行**: 単一スキル内で Pass A（qa→arch→sec）→ Pass B（final + Phase Gate）→ `design-review.md` を書く。部分再実行は `--only qa|arch|sec|final`。

**直列必須の理由**: 各専門サブパスの指摘は `design.md` に反映される。次のサブパスは **直前で更新された `design.md`** を入力とする。

**スタンドアロン**: `/kiro-validate-design` は対話型の独立レビュー用。AI-DLC オーケストレーションでは `/kiro-validate-design-qa` を使用する。

**実行順**: `spec-design` → `validate-design-qa` → `spec-tasks`

## Spec クリーンアップ（手動）

実装完了後、`docs/specs/{feature}/` は **手動で削除**する（自動ドキュメント化スキルはない）。

削除してよいのは当該 feature ディレクトリのみ。次は消さない:

- `docs/architecture/**`
- `docs/contracts/**`
- `docs/architecture/adr/**`

永続知は設計時に書いた architecture / contracts / ADR。roadmap の依存関係更新も手動で行う。

## 設計 validate の役割分担

詳細な入出力契約は「validate スキル契約」を参照。ここでは実行順と責務の概要のみ示す。

| スキル | 状態 | 担当役割 | 概要 |
| ------ | ---- | -------- | ---- |
| `/kiro-validate-design-qa` | 実装済 | 品質 / アーキテクト / セキュリティ / 設計者 | 統合 Pass A→B→C → `reviews/design-review.md`。`--only` で部分再実行可 |
| `/kiro-validate-design` | 既存 | — | 対話型スタンドアロンレビュー。AI-DLC では使用しない |

**実行順**

1. `/kiro-spec-design` で設計書を生成
2. `/kiro-validate-design-qa` を実行（スキル内で qa→arch→sec→final+phase-gate）
3. `design-review.md` が `VERDICT: GO` かつ Phase Gate `VERIFIED` なら **[ゲート] 設計フェーズ** → `/kiro-spec-tasks` へ進む

## 基本的な開発フロー

[調整者]: 下記のフローをオーケストレーションする。要求・設計の `[ゲート]` は統合レポートの Phase Gate `VERIFIED` 後に開く。タスクは `/kiro-verify-phase-gate` VERIFIED 後に **自動承認**し PR Summary を出してオーケストレーションを終了する（`/kiro-impl` には自動で進まない）。実装は明示的 `実装のみ` で `/kiro-verify-completion`（`FEATURE_GO`）後に **人間承認待ち** とする。

### 要求新規作成の場合

1. [プロダクトオーナー]: `/kiro-discovery` を実行する。Path C/D/E の新規 spec として `docs/specs/<ドメイン名>` を確定する
2. [プロダクトオーナー]: `/kiro-spec-requirements <ドメイン名>` を実行する。`spec.json` とプロジェクト記述入り `requirements.md` を初期化し、EARS 本文を書き込む（内部で `requirements-review-gate`）
3. [プロダクトオーナー / 品質 / セキュリティ]: `/kiro-validate-requirements` を実行する。統合 Pass A→B で自律ブラッシュアップし、`reviews/requirements-review.md` に記録する
4. **[ゲート] 要求フェーズ**: 調整者が `requirements-review.md` の GO・Phase Gate VERIFIED・**承認ゲートサマリ**を報告し、ユーザー承認を待つ。承認後 `approvals.requirements.approved: true`
5. [設計者]: `/kiro-spec-design` を実行する（brownfield は inline gap）
6. [品質 / アーキテクト / セキュリティ / 設計者]: `/kiro-validate-design-qa` を実行する。統合 Pass A→B で `reviews/design-review.md` を書く
7. **[ゲート] 設計フェーズ**: **決定事項サマリー**を含めてユーザー承認を待つ。承認後 `approvals.design.approved: true`
8. [設計者]: `/kiro-spec-tasks` を実行する
9. [調整者]: `/kiro-verify-phase-gate <feature> tasks` を実行する
10. **[自動承認] タスク**: `approvals.tasks.approved: true` + `ready_for_implementation: true` を設定 → **PR Summary Output** を出力 → オーケストレーション終了（実装には進まない）

### 要求更新の場合

1. [プロダクトオーナー]: `/kiro-discovery` を実行する
2. [プロダクトオーナー]: `/kiro-spec-requirements` を実行する（更新差分のみ）
3. [プロダクトオーナー / 品質 / セキュリティ]: `/kiro-validate-requirements` を実行する（更新部分・対話なし・`requirements-review.md`）
4. **[ゲート] 要求フェーズ**: `reviews/requirements-review.md` の **承認ゲートサマリ**を含めてユーザー承認を待つ
5. [設計者]: `/kiro-spec-design` を実行する（要求差分のみ更新）
6. [品質 / アーキテクト / セキュリティ / 設計者]: `/kiro-validate-design-qa` を実行する（更新部分・`design-review.md`）
7. **[ゲート] 設計フェーズ**: **決定事項サマリー**を含めてユーザー承認を待つ
8. [設計者]: `/kiro-spec-tasks` を実行する（更新部分のみタスク追加・上書き）
9. [調整者]: `/kiro-verify-phase-gate <feature> tasks` を実行する
10. **[自動承認] タスク**: `approvals.tasks.approved` + `ready_for_implementation` → PR Summary → オーケストレーション終了

### 要求更新不要、設計更新の場合

1. [プロダクトオーナー]: `/kiro-discovery` を実行する
2. [設計者]: `/kiro-spec-design` を実行する
3. [品質 / アーキテクト / セキュリティ / 設計者]: `/kiro-validate-design-qa` を実行する（更新部分・`design-review.md`）
4. **[ゲート] 設計フェーズ**: **決定事項サマリー**を含めてユーザー承認を待つ
5. [設計者]: `/kiro-spec-tasks` を実行する（更新部分のみ）
6. [調整者]: `/kiro-verify-phase-gate <feature> tasks` を実行する
7. **[自動承認] タスク**: `approvals.tasks.approved` + `ready_for_implementation` → PR Summary → オーケストレーション終了

### 実装のみの場合（既存 spec・承認済みタスク）

1. [プロダクトオーナー]: `/kiro-discovery` を実行する（Path A で実装のみと判定された場合）
2. [調整者]: `spec.json` で `approvals.tasks.approved: true` を確認する。未承認なら停止
3. [実装者]: `/kiro-impl` を実行する（Wave／バッチ単位: 親 mechanical → `/kiro-review` → `/kiro-verify-completion`（`BATCH` / 単一 `TASK`）→ `[x]`。実行モードは `complexity_tier`）
4. [品質管理者]: `/kiro-validate-impl` を実行する
5. [調整者]: `/kiro-verify-completion`（`FEATURE_GO`）を実行する
6. **[ゲート] 実装フェーズ**: **決定事項サマリー**を含めてユーザー承認を待つ
7. 終了

### Path B 直接実装の場合（spec なし）

1. [調整者]: `/kiro-discovery` を実行する。Path B と判定されたら以降 spec フローに入らない
2. [実装者]: メインコンテキストで直接実装する
3. [調整者]: `/kiro-verify-completion` で完了を検証する
4. [調整者]: 変更内容をユーザーに報告し、完了を確認する
5. 終了
