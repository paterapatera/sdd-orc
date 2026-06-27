# AI-DLC オーケストレーション

> **一時ファイル（削除予定）**  
> 本ドキュメントは作業用のドラフトです。正本はスキル定義に移行済みのため、**近いうちに削除します**。参照・更新は次を優先してください。
>
> - オーケストレーション: `.cursor/skills/kiro-orchestrate/`（`SKILL.md` + `rules/`）
> - validate 共通契約: `.cursor/skills/kiro-validate-shared/`（`contract.md`, `phase-contracts.md`）
> - エントリポイント: `/kiro-orchestrate`

仕様駆動開発に基づいて開発を進めるオーケストレーション。**エントリポイント**: `/kiro-orchestrate`（`.cursor/skills/kiro-orchestrate/`）

## 役割

- 調整者: フローのルーティング、フェーズゲート、巻き戻しを制御し、各役割のスキル実行をオーケストレーションする
- プロダクトオーナー: 要求の作成・自律的ブラッシュアップ、補足資料の整備
- セキュリティ管理者: 要求・設計段階の脆弱性、認証情報、個人情報の扱いをチェックする
- 設計者: 要求をもとに設計する、設計を元にタスクを作成する、設計の総合レビュー（最終ゲート）を行う
- アーキテクト管理者: SOLID原則、クリーンアーキテクチャの遵守。密結合を徹底排除（保守性の番人）
- 実装者: タスクを元にTDDする（`/kiro-impl` 内で実装サブエージェントとして動作）
- 品質管理者: 設計段階の異常系・エッジケース検証、実装完了後の feature 単位統合検証（`/kiro-validate-impl`）

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

- 各ステップは原則 **直列**。設計フェーズの QA / Arch / Sec は **`design.md` への反映が競合するため並列不可**。順序固定で **qa → arch → sec** とし、3 レポートすべて GO 後に `/kiro-validate-design-ex` を **最終ゲート** として実行する
- フロー途中でユーザーが方針を変更した場合、調整者がルートを再判定し、必要なステップから再開する
- 進捗確認が必要なときは `/kiro-spec-status` を実行する

### ゲート

各フェーズの完了時、調整者は **機械的検証結果** と **人間承認** の両方を確認してから次フェーズへ進む。

**フェーズゲート（`spec.json` approvals）**

| フェーズ | 通過条件 | `spec.json` 更新 | 次に進めるスキル |
| -------- | -------- | ---------------- | ---------------- |
| 要求 | `requirements.md` 生成済み + 要求 validate 3種すべて GO + 人間承認 | `approvals.requirements.generated: true` → 承認後 `approved: true` | `/kiro-spec-design` |
| 設計 | `design.md` 生成済み + 専門 validate（qa / arch / sec）GO + `/kiro-validate-design-ex` GO + 人間承認 | `approvals.design.generated: true` → 承認後 `approved: true` | `/kiro-spec-tasks` |
| タスク | `tasks.md` 生成済み + 人間承認 | `approvals.tasks.generated: true` → 承認後 `approved: true`, `ready_for_implementation: true` | `/kiro-impl` |
| 実装 | 全タスク `[x]` + 全タスク `/kiro-review` APPROVED + `/kiro-validate-impl` GO + 人間承認 | （phase を完了状態に更新） | 終了 |

**要求フェーズの validate 通過条件（すべて GO が必要）**

| スキル | 成果物 |
| ------ | ------ |
| `/kiro-validate-requirements` | `reviews/requirements-po.md` |
| `/kiro-validate-requirements-sec` | `reviews/requirements-sec.md` |
| `/kiro-validate-requirements-doc` | 補足資料 + AC 紐づけ済み `requirements.md` + `reviews/requirements-doc.md` |

**人間承認の運用**

調整者は各フェーズの機械的 validate がすべて GO になった時点で停止し、ユーザーに以下を報告する。

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
| 補足資料の解釈 | 用語定義・境界の取り方 |
| 設計・実装フェーズでも同様 | アーキテクチャ選択、脅威モデルの前提、タスク分割の方針 |

書き方: 各項目を「何を決めたか」「なぜそうしたか」「承認すると何が固定されるか」の 3 点で簡潔に。詳細は `reviews/*.md` を参照可能にする。

ユーザーが承認したら、調整者（または該当スキル）が `spec.json` の `approvals.<phase>.approved: true` を更新して次フェーズへ進む。`-y` による fast-track はユーザーが明示した場合のみ。直接実装フロー（Path B）では `spec.json` がないため、完了時のユーザー確認のみ行う。

**validate スキルの判定**

| 判定                     | 調整者の動作                                                                   |
| ------------------------ | ------------------------------------------------------------------------------ |
| `GO` / `APPROVED`        | 同一フェーズ内の残り validate があれば続行。全 validate 通過後、人間承認を待つ |
| `NO-GO` / `REJECTED`     | 巻き戻し（下記参照）。次フェーズへは進めない                                   |
| `MANUAL_VERIFY_REQUIRED` | ユーザーに不足情報・手動確認事項を報告し、解消まで停止                         |

**ゲート運用ルール**

- 人間承認なしに次フェーズへ進めない（`-y` による fast-track はユーザーが明示した場合のみ）
- `GO` 判定の前に各 validate スキル内で fresh-evidence を適用する。要求・設計・タスクの人間承認前は `/kiro-verify-phase-gate`（`PHASE_GATE`）
- 同一フェーズ内の専門 validate（qa / arch / sec）は、いずれかが `NO-GO` なら `/kiro-validate-design-ex` へ進めない
- `/kiro-validate-design-ex` は専門 validate の結果を入力として総合 GO/NO-GO を判定する **最終ゲート**（対話型の `/kiro-validate-design` とは別スキル）
- ゲート通過時、調整者は **現在フェーズ・次ステップ・未解決事項** をユーザーに報告する

### 巻き戻し

validate やレビューで `NO-GO` / `REJECTED` となった場合、調整者は **原因のあるフェーズの生成ステップ** に巻き戻す。

| 失敗した validate                 | 巻き戻し先                        | 再実行                                                               |
| --------------------------------- | --------------------------------- | -------------------------------------------------------------------- |
| `/kiro-validate-requirements`     | `/kiro-spec-requirements`         | 修正後 `/kiro-validate-requirements` から                            |
| `/kiro-validate-requirements-sec` | `/kiro-spec-requirements` または `requirements.md` | 修正後 `validate-requirements` → `sec` → `doc` の順で再 validate |
| `/kiro-validate-requirements-doc` | 補足資料のみ、または `requirements.md`（AC 文言修正が必要な場合） | 資料のみなら `doc` のみ。AC 修正が必要なら `spec-requirements` から再実行 |
| `/kiro-validate-design-qa`        | `/kiro-spec-design`               | 修正後 qa → arch → sec → design-ex の順で再 validate                 |
| `/kiro-validate-design-arch`      | `/kiro-spec-design`               | 同上                                                                 |
| `/kiro-validate-design-sec`       | `/kiro-spec-design`               | 同上                                                                 |
| `/kiro-validate-design-ex`        | `/kiro-spec-design`               | 修正後 qa → arch → sec → design-ex の順で再 validate                 |
| `/kiro-impl` 内タスク review      | 当該タスクの実装                  | 修正後 `/kiro-review` を再実行                                       |
| `/kiro-validate-impl`             | 原因タスク or 設計                | タスク単位修正 → `/kiro-impl`、設計起因なら `/kiro-spec-design` 以降 |

**巻き戻しの運用ルール**

- 巻き戻し時、調整者は **失敗理由・影響範囲・再実行ステップ** を明示する
- 要求変更が設計・実装に波及する場合、調整者は **どこまで巻き戻すか**（要求のみ / 設計まで / タスクまで）をユーザーに確認する
- 同一ステップで `NO-GO` が **2回連続** した場合、調整者は停止し、ユーザーと方針の再合意を求める
- 更新フロー（要求更新・設計更新）では、**変更差分に関係しない downstream 成果物は再生成しない**

## 既存 Kiro スキルとの接続

### `/kiro-spec-init`（新規 spec の初期化）

要求新規作成フローでは、discovery の直後に **必ず** `/kiro-spec-init` を実行する（discovery が `brief.md` を書き済みの場合も init で `spec.json` を確定する）。

| スキル | タイミング | 前提 | 成果物 |
| ------ | ---------- | ---- | ------ |
| `/kiro-discovery` | フロー開始 | なし | Path 判定、`brief.md`（Path C/D/E） |
| `/kiro-spec-init` | discovery 直後（Path C/D/E の新規 spec） | `brief.md` があれば読み込む | `spec.json`, `requirements.md`（プロジェクト記述のみ） |
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

**`/kiro-impl` 内の 1 タスクあたりのループ**（調整者は impl スキルに委譲するが、停止条件を監視する）

1. 実装サブエージェントが TDD 実装 → `READY_FOR_REVIEW`
2. レビューサブエージェントが `/kiro-review` プロトコルで検証 → `APPROVED` / `REJECTED`
3. `APPROVED` 後、`/kiro-verify-completion`（claim type: `TASK`）で fresh evidence 確認
4. `tasks.md` の当該タスクを `[x]` に更新し、選択的 git commit
5. `REJECTED` は最大 2 回リトライ → 失敗時 `/kiro-debug` → それでも失敗なら `_Blocked:_` で停止

**調整者の関与**

- 全タスク `[x]` になるまで `/kiro-validate-impl` へ進めない
- `_Blocked:_` タスクが残ったら停止し、ユーザーに報告
- autonomous mode では impl 完了後に自動で `/kiro-validate-impl` が走る（手動 mode では調整者が明示 dispatch）

### 既存 validate との棲み分け

| 既存スキル | フェーズ | 本フローでの位置づけ |
| ---------- | -------- | -------------------- |
| `requirements-review-gate`（`kiro-spec-requirements` 内蔵） | 要求生成**前** | 機械チェック + ドラフト品質。対話的合意は担当しない |
| `/kiro-validate-gap` | 要求→設計の間（任意） | brownfield のみ。既存コードとのギャップ分析 |
| `/kiro-validate-design-ex` | 設計 validate **最終（AI-DLC）** | qa/arch/sec のレポートを入力に総合 GO/NO-GO → `reviews/design-final.md`。専門分析は繰り返さない |
| `/kiro-validate-design` | 設計レビュー（**スタンドアロン**） | 対話型の独立レビュー。オーケストレートフローでは使用しない |
| `/kiro-validate-impl` | 実装完了後 | タスク横断の統合検証。タスク単位チェックは `/kiro-review` の責務 |
| `/kiro-verify-completion` | 各 GO 宣言前 | fresh-evidence ゲート。調整者が各フェーズゲートと impl 内で適用 |

### brownfield オプション

既存コードベースへの変更で、要求新規作成・要求更新フローの場合:

- `/kiro-spec-design` の直前に `/kiro-validate-gap` を **任意挿入** できる
- 調整者はコードベース規模・既存実装の有無で判断する。greenfield ではスキップ

## スキル実装状況

### 調整者（オーケストレーター）

| スキル | パス | 概要 |
| ------ | ---- | ---- |
| `/kiro-orchestrate` | `.cursor/skills/kiro-orchestrate/` | フロールーティング、フェーズゲート、巻き戻し。実行手順は `rules/` に分離（`routing`, `flows`, `gates`, `rollback`） |

### validate スキル（6種 specialist + 1 final gate・実装済み）

共通契約: `.cursor/skills/kiro-validate-shared/contract.md`（各 validate スキルから参照。重複読込み回避）

| スキル                            | 担当役割           | 概要                                                                          |
| --------------------------------- | ------------------ | ----------------------------------------------------------------------------- |
| `/kiro-validate-requirements`     | プロダクトオーナー | 要求の自律的ブラッシュアップ（対話なし）                                      |
| `/kiro-validate-requirements-sec` | セキュリティ管理者 | 要求段階のセキュリティレビュー（対話なし・推奨はレポートに記録）              |
| `/kiro-validate-requirements-doc` | プロダクトオーナー | EARS 要求を支える補足資料の作成（用語集・コンテキスト図・ユースケース図ほか） |
| `/kiro-validate-design-qa`        | 品質管理者         | 異常系・エッジケースの網羅チェック（チェックリスト出力）                      |
| `/kiro-validate-design-arch`      | アーキテクト管理者 | SOLID / 疎結合 / 拡張性シミュレーション                                       |
| `/kiro-validate-design-sec`       | セキュリティ管理者 | 脅威モデル・認証情報・PII                                                     |
| `/kiro-validate-design-ex`        | 設計者             | AI-DLC 最終ゲート。3 専門レポートの統合 GO/NO-GO（対話なし）                  |

## validate スキル契約

### 共通規約

**レビューレポートの配置**

```
docs/specs/<feature>/reviews/
├── requirements-po.md      # /kiro-validate-requirements
├── requirements-sec.md     # /kiro-validate-requirements-sec
├── requirements-doc.md     # /kiro-validate-requirements-doc
├── design-qa.md            # /kiro-validate-design-qa
├── design-arch.md          # /kiro-validate-design-arch
├── design-sec.md           # /kiro-validate-design-sec
└── design-final.md         # /kiro-validate-design-ex
```

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
- 調整者は **要求・設計・タスク** の機械 validate 完了後、人間承認前に `/kiro-verify-phase-gate`（`PHASE_GATE`）を適用する
- **実装フェーズ**完了時（`/kiro-validate-impl` GO 後）は `/kiro-verify-completion`（`FEATURE_GO`）を適用する

### 要求フェーズ validate

| スキル | 入力 | 出力・副作用 | やらないこと |
| ------ | ---- | ------------ | ------------ |
| `/kiro-validate-requirements` | `requirements.md`, `brief.md`, steering | `reviews/requirements-po.md`。必要なら `requirements.md` を自律的に修正。**`## Decisions`** に判断・前提・トレードオフを記録 | EARS 機械チェック（`requirements-review-gate` の領域）、セキュリティ深掘り、**ユーザーとの対話** |
| `/kiro-validate-requirements-sec` | `requirements.md`, steering の security 制約 | `reviews/requirements-sec.md`。推奨と採否・見送り理由を **`## Decisions`** に記録 | 要求の機能スコープ判断（PO の領域）、**ユーザーとの対話** |
| `/kiro-validate-requirements-doc` | `requirements.md`, 既存補足資料 | 補足資料ファイル、`requirements.md` の「関連する補足資料」列更新、`reviews/requirements-doc.md` | 要求の新規追加（PO validate で確定済みの範囲外の AC 追加はしない） |

**実行順（直列・順序固定）**: `validate-requirements` → `sec` → `doc`

**自律実行の原則**

- validate 中はユーザーに質問しない。曖昧さは合理的な前提で補い、`## Decisions` に記録する
- 前提を置けず進められない場合は `VERDICT: NO-GO` または `MANUAL_VERIFY_REQUIRED` とし、承認ゲートでユーザーに判断を委ねる（validate 中の対話は行わない）

**`requirements-review-gate` との棲み分け**

| | `requirements-review-gate`（生成前） | `/kiro-validate-requirements`（生成後） |
| - | ------------------------------------ | --------------------------------------- |
| 目的 | 書き込み前のドラフト品質・EARS 機械適合 | 生成後の意味的整合・曖昧さの自律的解消 |
| 形式 | 内部ループ（最大 2 パス） | 自律実行（対話なし）。判断はレポート `## Decisions` に記録 |
| 成果物 | `requirements.md` 初版 | `reviews/requirements-po.md` + 必要な修正 |
| ユーザーへの報告 | なし（生成スキル内で完結） | **承認ゲート**で `## Decisions` を要約して提示 |

### 設計フェーズ validate

| スキル | 入力 | 出力 | やらないこと |
| ------ | ---- | ---- | ------------ |
| `/kiro-validate-design-qa` | `requirements.md`, `design.md` | `reviews/design-qa.md`。指摘の `design.md` 反映 | アーキテクチャ判断、脅威モデル |
| `/kiro-validate-design-arch` | **qa 反映後の** `requirements.md`, `design.md`, steering | `reviews/design-arch.md`。指摘の `design.md` 反映 | セキュリティ、テストケース網羅 |
| `/kiro-validate-design-sec` | **arch 反映後の** `requirements.md`, `design.md` | `reviews/design-sec.md`。指摘の `design.md` 反映 | アーキテクチャ、QA チェックリスト |
| `/kiro-validate-design-ex` | 上記 3 レポート + **最終** `design.md` | `reviews/design-final.md`（総合 GO/NO-GO、`## Decisions`） | qa/arch/sec の分析の **再実行** |

**実行順（直列・順序固定）**: `validate-design-qa` → `validate-design-arch` → `validate-design-sec`

**直列必須の理由**: 各専門 validate の指摘は `design.md` に反映される。並列だと同一ファイルへの修正が競合する。

**`/kiro-validate-design-ex` の入力契約**

1. `docs/specs/<feature>/reviews/design-{qa,arch,sec}.md` がすべて存在し、いずれも `VERDICT: GO` であること。未作成・NO-GO があれば総合レビューに入らない
2. 総合レビューは 3 レポートの findings を **統合・優先順位付け** し、最大 3 件の横断的懸念に絞る
3. 専門領域の深掘りは行わない。不足があれば該当専門 validate への巻き戻しを指示
4. 出力は共有契約形式（`reviews/design-final.md` の `VERDICT` / `## Decisions`）

**スタンドアロン**: `/kiro-validate-design` は対話型の独立レビュー用。AI-DLC オーケストレーションでは `/kiro-validate-design-ex` を使用する。

**実行順**: `spec-design` → `validate-design-qa` → `validate-design-arch` → `validate-design-sec` → `validate-design-ex` → `spec-tasks`

**直列必須の理由**: 各専門 validate の指摘は `design.md` への修正として反映される。並列実行すると同一ファイルへの競合が発生する。次の validate は **直前ステップで更新された `design.md`** を入力とする。

## 要求補足資料（`/kiro-validate-requirements-doc`）

`/kiro-validate-requirements-doc` は、EARS 形式の `requirements.md` を書き起こし・検証しやすくするための **補足資料** を作成する。各受け入れ条件（AC）は `requirements.md` の「関連する補足資料」列から、対応する資料 ID へ参照する。本スキルは補足資料の作成に加え、既存 AC への資料 ID 紐づけも行う。

**成果物の配置（例）**

| 資料                 | スコープ              | 配置例                                                    |
| -------------------- | --------------------- | --------------------------------------------------------- |
| 用語集（データ辞書） | プロジェクト全体      | `docs/specs/_shared/glossary.md`                          |
| コンテキスト図       | 複数ドメイン全体で1枚 | `docs/specs/_shared/context-diagram.md`                   |
| ユースケース図       | ドメイン単位で1枚     | `docs/specs/<ドメイン名>/supplements/use-case-diagram.md` |
| その他の補足資料     | 要件の複雑さに応じて  | `docs/specs/<ドメイン名>/supplements/` 配下               |

### 最優先で作成すべき資料

**1. 用語集（データ辞書）**

- **目的**: EARS の「条件（When/While）」や「トリガー（When）」で使う言葉の定義を統一する
- **効果**: 「ユーザー」「管理者」「決済完了」などの言葉のブレによる誤解を防ぐ

**2. コンテキスト図（複数ドメイン全体で1枚）**

- **目的**: 開発するシステム全体の「外枠」と、関わるすべての外部システムやアクターの全体関係を網羅する
- **効果**: システム全体の境界線が1枚でわかるため、開発範囲（スコープ）の認識ズレを防ぐ

**3. ユースケース図（ドメイン単位で1枚）**

- **目的**: 業務領域（ドメイン）ごとに整理して詳細化する
- **効果**: 「注文」「決済」「配送」などドメインごとに図を分け、ユースケースが多すぎて読めなくなるのを防ぎ、EARS への書き起こしをスムーズにする

### 要件の複雑さに応じて追加すべき資料

| #   | 資料                                            | 対象                                                       | 効果                                                                                               | 主に補強する EARS パターン  |
| --- | ----------------------------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | --------------------------- |
| 1   | 状態遷移図 / 状態遷移表                         | 複雑なステータスを持つシステム（EC 注文、会員ランク等）    | `While <特定の状態>` 定義時の遷移漏れ・矛盾を防ぐ                                                  | State-driven                |
| 2   | 画面遷移図（UI コンポーネント・ダイアログ含む） | 画面操作手順が長い、またはシステムとのやり取りが複雑な機能 | Mermaid で UI 要素と遷移を可視化し、When（トリガー）や While（状態）への書き起こしをスムーズにする | Event-driven / State-driven |
| 3   | エラーハンドリングマトリクス                    | 例外処理やエラーパターンが多いシステム                     | `If <エラー発生時>, then <システム側の対応>` を網羅するチェックリスト                              | Unwanted Behavior           |
| 4   | ドメインモデル図（概念データモデル）            | エンティティ間の関係が複雑なシステム                       | EARS の主語・目的語に登場するデータ構造を検証できる                                                | 全パターン                  |
| 5   | システム連携仕様書（インターフェース一覧）      | 外部基幹システムや別コンポーネントとのデータ連携           | API ステータスコードと紐づけ、エラーハンドリング要求を漏れなく具体化                               | Event-driven / State-driven |
| 6   | UI モック                                       | ユーザーの操作があるシステム                               | ボタン非活性・入力欄の表示/非表示など画面独自の振る舞い要件を視覚的に洗い出す                      | State-driven / Optional     |
| 7   | データライフサイクル図                          | データ量が膨大、または旧システムからの移行があるシステム   | 作成・更新・削除・アーカイブのタイミングを明確化し、バッチ処理・容量削減要件を EARS で定義         | バッチ処理・非機能要求      |

**資料 ID の命名例**

補足資料には `requirements.md` から参照できる ID を付与する（例: `Glossary-01`, `Context-01`, `UC-Order-01`, `State-02`, `Flow-03`, `ErrMatrix-01`）。

## 設計 validate の役割分担

詳細な入出力契約は「validate スキル契約」を参照。ここでは実行順と責務の概要のみ示す。

| スキル                       | 状態   | 担当役割           | 概要                                                                            |
| ---------------------------- | ------ | ------------------ | ------------------------------------------------------------------------------- |
| `/kiro-validate-design-qa`   | 実装済 | 品質管理者         | 異常系・エッジケースの網羅チェック → `reviews/design-qa.md`                     |
| `/kiro-validate-design-arch` | 実装済 | アーキテクト管理者 | SOLID / 疎結合 / 拡張性シミュレーション → `reviews/design-arch.md`              |
| `/kiro-validate-design-sec`  | 実装済 | セキュリティ管理者 | 脅威モデル・認証情報・PII → `reviews/design-sec.md`                           |
| `/kiro-validate-design-ex`   | 実装済 | 設計者             | 3 レポートを入力に総合 GO/NO-GO → `reviews/design-final.md`。**最終ゲート** |
| `/kiro-validate-design`      | 既存   | —                  | 対話型スタンドアロンレビュー。AI-DLC では使用しない                           |

**実行順**

1. `/kiro-spec-design` で設計書を生成
2. `/kiro-validate-design-qa` → `/kiro-validate-design-arch` → `/kiro-validate-design-sec` を **直列** 実行（順序固定。`design.md` 反映の競合を避ける）
3. 3 レポートすべて `VERDICT: GO` の場合のみ、`/kiro-validate-design-ex` で総合 GO/NO-GO を判定
4. GO なら **[ゲート] 設計フェーズ** → `/kiro-spec-tasks` へ進む

## 基本的な開発フロー

[調整者]: 下記のフローをオーケストレーションする。`[ゲート]` の直前に `/kiro-verify-phase-gate`（要求/設計/タスク）または `/kiro-verify-completion`（実装、`FEATURE_GO`）で機械検証し、通過後に **人間承認待ち** とする。

### 要求新規作成の場合

1. [プロダクトオーナー]: `/kiro-discovery` を実行する。Path C/D/E の新規 spec として `docs/specs/<ドメイン名>` を確定する
2. [プロダクトオーナー]: `/kiro-spec-init <ドメイン名>` を実行する。`spec.json` とプロジェクト記述入り `requirements.md` を初期化する
3. [プロダクトオーナー]: `/kiro-spec-requirements` を実行する（内部で `requirements-review-gate` 通過後に EARS 本文を書き込む）
4. [プロダクトオーナー]: `/kiro-validate-requirements` を実行する。対話なしで自律的にブラッシュアップし、判断は `reviews/requirements-po.md` の `## Decisions` に記録する
5. [セキュリティ管理者]: `/kiro-validate-requirements-sec` を実行する。対話なしでレビューし、推奨の採否は `reviews/requirements-sec.md` の `## Decisions` に記録する
6. [プロダクトオーナー]: `/kiro-validate-requirements-doc` を実行する。補足資料を作成し、AC への資料 ID 紐づけを行う
7. [調整者]: `/kiro-verify-phase-gate <feature> requirements` を実行する
8. **[ゲート] 要求フェーズ**: 調整者が validate 3種の GO・成果物・**決定事項サマリー**（各レポートの `## Decisions` 要約）を報告し、ユーザー承認を待つ。承認後 `approvals.requirements.approved: true`
9. [設計者]: `/kiro-validate-gap` を実行する（brownfield のみ・任意）
10. [設計者]: `/kiro-spec-design` を実行する
11. [品質管理者]: `/kiro-validate-design-qa` を実行する
12. [アーキテクト管理者]: `/kiro-validate-design-arch` を実行する（qa 通過・`design.md` 反映後）
13. [セキュリティ管理者]: `/kiro-validate-design-sec` を実行する（arch 通過・`design.md` 反映後）
14. [設計者]: `/kiro-validate-design-ex` を実行する。qa / arch / sec レポートを入力に総合 GO/NO-GO を判定。**最終ゲート**
15. [調整者]: `/kiro-verify-phase-gate <feature> design` を実行する
16. **[ゲート] 設計フェーズ**: **決定事項サマリー**を含めてユーザー承認を待つ。承認後 `approvals.design.approved: true`
17. [設計者]: `/kiro-spec-tasks` を実行する
18. [調整者]: `/kiro-verify-phase-gate <feature> tasks` を実行する
19. **[ゲート] タスクフェーズ**: **決定事項サマリー**（`tasks.md` と spec-tasks サマリーから合成）を含めてユーザー承認を待つ。承認後 `approvals.tasks.approved: true`
20. [実装者]: `/kiro-impl` を実行する（タスクごとに `/kiro-review` → `/kiro-verify-completion`）
21. [品質管理者]: `/kiro-validate-impl` を実行する
22. [調整者]: `/kiro-verify-completion`（`FEATURE_GO`）を実行する
23. **[ゲート] 実装フェーズ**: **決定事項サマリー**を含めてユーザー承認を待つ
24. 終了

### 要求更新の場合

1. [プロダクトオーナー]: `/kiro-discovery` を実行する
2. [プロダクトオーナー]: `/kiro-spec-requirements` を実行する（更新差分のみ）
3. [プロダクトオーナー]: `/kiro-validate-requirements` を実行する（更新部分のみ・対話なし・判断は `## Decisions` に記録）
4. [セキュリティ管理者]: `/kiro-validate-requirements-sec` を実行する（更新部分のみ・対話なし・採否は `## Decisions` に記録）
5. [プロダクトオーナー]: `/kiro-validate-requirements-doc` を実行する（更新部分の補足資料）
6. [調整者]: `/kiro-verify-phase-gate <feature> requirements` を実行する
7. **[ゲート] 要求フェーズ**: **決定事項サマリー**を含めてユーザー承認を待つ
8. [設計者]: `/kiro-spec-design` を実行する（要求差分のみ更新）
9. [品質管理者]: `/kiro-validate-design-qa` を実行する（更新部分）
10. [アーキテクト管理者]: `/kiro-validate-design-arch` を実行する（更新部分・qa 反映後）
11. [セキュリティ管理者]: `/kiro-validate-design-sec` を実行する（更新部分・arch 反映後）
12. [設計者]: `/kiro-validate-design-ex` を実行する。**最終ゲート**
13. [調整者]: `/kiro-verify-phase-gate <feature> design` を実行する
14. **[ゲート] 設計フェーズ**: **決定事項サマリー**を含めてユーザー承認を待つ
15. [設計者]: `/kiro-spec-tasks` を実行する（更新部分のみタスク追加・上書き）
16. [調整者]: `/kiro-verify-phase-gate <feature> tasks` を実行する
17. **[ゲート] タスクフェーズ**: **決定事項サマリー**を含めてユーザー承認を待つ
18. [実装者]: `/kiro-impl` を実行する
19. [品質管理者]: `/kiro-validate-impl` を実行する
20. [調整者]: `/kiro-verify-completion`（`FEATURE_GO`）を実行する
21. **[ゲート] 実装フェーズ**: **決定事項サマリー**を含めてユーザー承認を待つ
22. 終了

### 要求更新不要、設計更新の場合

1. [プロダクトオーナー]: `/kiro-discovery` を実行する
2. [設計者]: `/kiro-spec-design` を実行する
3. [品質管理者]: `/kiro-validate-design-qa` を実行する（更新部分）
4. [アーキテクト管理者]: `/kiro-validate-design-arch` を実行する（更新部分・qa 反映後）
5. [セキュリティ管理者]: `/kiro-validate-design-sec` を実行する（更新部分・arch 反映後）
6. [設計者]: `/kiro-validate-design-ex` を実行する。**最終ゲート**
7. [調整者]: `/kiro-verify-phase-gate <feature> design` を実行する
8. **[ゲート] 設計フェーズ**: **決定事項サマリー**を含めてユーザー承認を待つ
9. [設計者]: `/kiro-spec-tasks` を実行する（更新部分のみ）
10. [調整者]: `/kiro-verify-phase-gate <feature> tasks` を実行する
11. **[ゲート] タスクフェーズ**: **決定事項サマリー**を含めてユーザー承認を待つ
12. [実装者]: `/kiro-impl` を実行する
13. [品質管理者]: `/kiro-validate-impl` を実行する
14. [調整者]: `/kiro-verify-completion`（`FEATURE_GO`）を実行する
15. **[ゲート] 実装フェーズ**: **決定事項サマリー**を含めてユーザー承認を待つ
16. 終了

### 実装のみの場合（既存 spec・承認済みタスク）

1. [プロダクトオーナー]: `/kiro-discovery` を実行する（Path A で実装のみと判定された場合）
2. [調整者]: `spec.json` で `approvals.tasks.approved: true` を確認する。未承認なら停止
3. [実装者]: `/kiro-impl` を実行する（タスクごとに `/kiro-review` → `/kiro-verify-completion`）
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
