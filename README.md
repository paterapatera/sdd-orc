# AI-DLC オーケストレーション

仕様駆動開発（SDD）をエージェントスキルで回すリポジトリ。実行手順の正本は `.agents/skills/` の各 `SKILL.md` と、オーケストレーションの `rules/`。この README は概要・起動規則・フローの案内である。

**よく使うコマンド**（`<feature>` は `docs/specs/<feature>/` のディレクトリ名。`/sdd-orchestrate` と `/sdd-impl` では省略不可）

| コマンド | 役割 |
| -------- | ---- |
| `/sdd-discovery` | 新規作業の入口。Path 判定と `brief.md`（必要なら `roadmap.md`）。この会話では orchestrate しない |
| `/sdd-orchestrate <feature>` | 要求・設計・タスクの調整。再開も同じコマンド。実装は付けない |
| `/sdd-orchestrate <feature> 実装のみ` | `ready_for_implementation: true` の spec の実装フロー |
| `/sdd-impl <feature>` | 実装のみを直接起動する場合 |
| `/sdd-spec-status <feature>` | 1 spec の進捗。引数なしは全 spec 一覧 |
| `/propose-quality-tools <language> <scale>` | SDD 前の品質ツール提案 |

スキル定義: `.agents/skills/sdd-orchestrate/`（`SKILL.md` + `rules/`）。validate 共通契約: `.agents/skills/sdd-validate-shared/`。

## 起動規則（checkout / セッション）

- **`<feature>` は明示する。** git ブランチ名からは解決しない（Agents Window の `cursor/{id}` ブランチでも同じ）。
- **Discovery は standalone。** 書いたら止まり、別チャットで `/sdd-orchestrate <feature>` を実行する。
- **M/L はフェーズごとに新しいチャット、同じ Git checkout。** 機械ゲート通過後に Phase Handoff を出す（`go` 待ちはしない）。人間が成果物を確認し、問題があれば**同じチャット**で修正指示、問題がなければ新しいチャットで `/sdd-orchestrate <feature>`。次フェーズを同じ会話で続けない。新しい worktree をフェーズごとに作らない。S は例外。
- **未 commit のファイルは新しい worktree に乗らない。** 次チャットが別 checkout なら、その前に commit する。
- **Discovery の commit 先:** Path C / 単一 spec は feature ブランチ（brief だけを `main` に載せない）。Path D/E で並列可能な spec があるときは、brief 一式 + `roadmap.md` をマージ先（`main` など）へ 1 commit し、その先端から ready な spec だけ checkout する。
- **Upstream は今のディスクだけ見る。** 隣の worktree で終わっていても、この checkout に `tasks.md` が無ければ downstream は始めない。upstream の PR をマージした先端からやり直す。

## SDD 実施前の推奨（品質ツール）

`/sdd-discovery` や `/sdd-orchestrate <feature>` の**前に**、`/propose-quality-tools` の実行を推奨する。言語と規模（`S` / `M` / `L`）に合わせて、フォーマット・型検査・SOLID 近似・依存境界などの **無料/OSS 品質ツールチェーン**を提案し、設計・実装フェーズのアーキテクチャ／品質ゲートの前提を揃える。

```text
/propose-quality-tools <language> <scale>
```

例: `/propose-quality-tools typescript M`。提案の採否と設定反映はユーザー判断（依頼がない限り自動インストールしない）。スキル定義: `.agents/skills/propose-quality-tools/`。

## 役割

- 調整者: フローのルーティング、フェーズゲート、巻き戻しを制御し、各役割のスキル実行をオーケストレーションする
- プロダクトオーナー: 要求の作成・自律的ブラッシュアップ、要求の総合レビュー（最終ゲート）
- セキュリティ管理者: 要求・設計段階の脆弱性、認証情報、個人情報の扱いをチェックする
- 設計者: 要求をもとに設計する、設計を元にタスクを作成する、設計の総合レビュー（最終ゲート）を行う
- アーキテクト管理者: SOLID原則、クリーンアーキテクチャの遵守。密結合を徹底排除（保守性の番人）
- 実装者: タスクを元にTDDする（`/sdd-impl` 内で実装サブエージェントとして動作）
- 品質管理者: 要求段階のテスト容易性検証、設計段階の異常系・エッジケース検証、実装完了後の feature 単位統合検証（`/sdd-validate-impl`）

## 調整者の責務

調整者は各役割の作業内容そのものを担わず、**いつ・誰に・何を実行させるか** を決め、結果に応じて前進・停止・巻き戻しを行う。

### ルーティング

`/sdd-discovery` はオーケストレーションの外で先に走る。調整者は `brief.md` / `spec.json` とユーザー上書きから、下記フローのどれを走らせるか決める。discovery は自動起動しない。

| 条件                         | 走らせるフロー |
| ---------------------------- | -------------- |
| 新規 spec・新規要求          | 要求新規作成   |
| 既存 spec の要求変更         | 要求更新       |
| 要求は確定済み、設計のみ変更 | 設計更新       |
| spec 更新不要、実装のみ      | 実装のみ（明示のときだけ） |
| spec 不要（Path B）          | 直接実装（orchestrate に入らない） |

**ルーティングの判断基準**

- Discovery **Path A**（既存 spec で足りる）→ 要求更新 or 設計更新 or 実装のみのいずれかに振り分ける
- Discovery **Path B**（spec 不要）→ **直接実装フロー**（下記）。spec を経由しない。`/sdd-orchestrate` は使わない
- Discovery **Path C**（新規単一 spec）→ 要求新規作成フロー（`/sdd-orchestrate <feature>`）
- Discovery **Path D/E**（複数 spec・混合分解）→ spec 単位で `/sdd-orchestrate <feature>`。ready な spec は並列 checkout 可。downstream は upstream がこの checkout で tasks 生成済みになるまで待つ
- ユーザーが明示した場合（「要求だけ更新」「実装だけ」等）は、その指示を優先する
- 起動は常に `/sdd-orchestrate <feature>`。feature 無し・ブランチ名からの推測はしない

**実行中の制御**

- 各ステップは原則 **直列**。要求の統合 validate はスキル内で **po → qa → sec → final+phase-gate**（`/sdd-validate-requirements`）。設計は **qa → arch → sec → final+phase-gate**（`/sdd-validate-design-qa`）
- フロー途中でユーザーが方針を変更した場合、調整者がルートを再判定し、必要なステップから再開する
- 進捗確認が必要なときは `/sdd-spec-status <feature>`（一覧は引数なし）

### ゲート

各フェーズの完了時、調整者は **機械的検証結果** を確認する。**要求・設計**（M/L）は `VERDICT: GO` かつ Phase Gate `VERIFIED` なら Phase Handoff を出して**次フェーズへは進まない**（人間の `go` は待たない）。人間が成果物を確認する: 問題があれば同じチャットで修正指示、問題がなければ新しいチャットで `/sdd-orchestrate <feature>`。**タスク**（および S の仕様一式）は機械的 readiness のあと `ready_for_implementation: true` を立て、PR Summary を出す。

**フェーズゲート（`spec.json`）**

| フェーズ | 通過条件 | `spec.json` 更新 | 次に進めるスキル |
| -------- | -------- | ---------------- | ---------------- |
| 要求 | `requirements.md` 生成済み + `/sdd-validate-requirements` GO（`requirements-review.md` の Phase Gate VERIFIED） | `approvals.requirements.generated: true` | 人間確認後、次チャットで設計 |
| 設計 | `design.md` 生成済み + `/sdd-validate-design-qa` GO（`design-review.md` の Phase Gate VERIFIED） | `approvals.design.generated: true` | 人間確認後、次チャットでタスク |
| タスク | `tasks.md` 生成済み + `/sdd-verify-phase-gate` VERIFIED | `approvals.tasks.generated: true` → `ready_for_implementation: true` | 人間確認後、明示的 `実装のみ` |
| 実装 | 全タスク `[x]` + `/sdd-review` APPROVED + `/sdd-validate-impl <feature>` GO + `/sdd-verify-completion` (`FEATURE_GO`) | （phase を完了状態に更新） | 終了 |

`go` / `fix` コマンドはない。M/L の会話分割はトークン節約。次フェーズへ進む行為そのものが「問題なし」。S は 1 チャット。

**要求フェーズの validate 通過条件**

| スキル | 成果物 |
| ------ | ------ |
| `/sdd-validate-requirements`（統合・Pass A po→qa→sec + Pass B final + Phase Gate） | `reviews/requirements-review.md`（`VERDICT: GO` かつ Phase Gate `STATUS: VERIFIED`） |

部分再実行は `--only po|qa|sec|final`。いずれも canonical レポートは `requirements-review.md` のみ。

**設計フェーズの validate 通過条件**

| スキル | 成果物 |
| ------ | ------ |
| `/sdd-validate-design-qa`（統合・Pass A qa→arch→sec + Pass B final + Phase Gate） | `reviews/design-review.md`（`VERDICT: GO` かつ Phase Gate `STATUS: VERIFIED`） |

部分再実行は `--only qa|arch|sec|final`。いずれも canonical レポートは `design-review.md` のみ。

**validate スキルの判定**

| 判定                     | 調整者の動作                                                                   |
| ------------------------ | ------------------------------------------------------------------------------ |
| `GO` / `APPROVED`        | 同一フェーズ内の残り validate があれば続行。要求・設計（M/L）は全 validate 通過後に Phase terminal。タスクは phase-gate VERIFIED 後に `ready_for_implementation: true` |
| `NO-GO` / `REJECTED`     | 巻き戻し（下記参照）。次フェーズへは進めない                                   |
| `MANUAL_VERIFY_REQUIRED` | ユーザーに不足情報・手動確認事項を報告し、解消まで停止                         |

**ゲート運用ルール**

- `go` / `fix` コマンドはない。人間は成果物を確認する。問題があれば同じチャットで修正指示、問題がなければ新しいチャットで `/sdd-orchestrate <feature>`（M/L の会話分割はトークン節約）
- `GO` 判定の前に各 validate スキル内で fresh-evidence を適用する。要求・設計は統合レポートの Phase Gate、タスクは `/sdd-verify-phase-gate`
- 同一フェーズ内の専門 validate（要求: po / qa / sec、設計: qa / arch / sec）は、いずれかが `NO-GO` なら最終ゲート（`/sdd-validate-requirements --only final` / `/sdd-validate-design-qa --only final`）へ進めない
- `/sdd-validate-requirements --only final` / `/sdd-validate-design-qa --only final` は専門 validate の結果を入力として総合 GO/NO-GO を判定する **最終ゲート**
- 要求 / 設計の Phase terminal では **Phase Handoff** を出して終了する。タスク完了直後は **PR Summary Output** を出し、チャット側に実装用の次コマンド（同じ checkout で `/sdd-orchestrate <feature> 実装のみ` または `/sdd-impl <feature>`）を書いてオーケストレーションを終了する

### 巻き戻し

validate やレビューで `NO-GO` / `REJECTED` となった場合、調整者は **原因のあるフェーズの生成ステップ** に巻き戻す。

| 失敗した validate                 | 巻き戻し先                        | 再実行                                                               |
| --------------------------------- | --------------------------------- | -------------------------------------------------------------------- |
| `/sdd-validate-requirements`     | `/sdd-spec-requirements`         | 修正後 po → qa → sec → requirements-ex の順で再 validate             |
| `/sdd-validate-requirements --only qa`  | `/sdd-spec-requirements` または `requirements.md` | 同上                                                    |
| `/sdd-validate-requirements --only sec` | `/sdd-spec-requirements` または `requirements.md` | 同上                                                    |
| `/sdd-validate-requirements --only final`  | `/sdd-spec-requirements`（専門起因なら該当 validate） | 修正後 po → qa → sec → requirements-ex の順で再 validate |
| `/sdd-validate-design-qa`        | `/sdd-spec-design`               | 修正後 qa → arch → sec → design-ex の順で再 validate                 |
| `/sdd-validate-design-qa --only arch`      | `/sdd-spec-design`               | 同上                                                                 |
| `/sdd-validate-design-qa --only sec`       | `/sdd-spec-design`               | 同上                                                                 |
| `/sdd-validate-design-qa --only final`        | `/sdd-spec-design`               | 修正後 qa → arch → sec → design-ex の順で再 validate                 |
| `/sdd-impl` 内タスク review      | 当該タスクの実装                  | 修正後 `/sdd-review` を再実行                                       |
| `/sdd-validate-impl`             | 原因タスク or 設計                | タスク単位修正 → `/sdd-impl <feature>`、設計起因なら `/sdd-spec-design <feature>` 以降 |

**巻き戻しの運用ルール**

- 巻き戻し時、調整者は **失敗理由・影響範囲・再実行ステップ** を明示する
- 要求変更が設計・実装に波及する場合、調整者は **どこまで巻き戻すか**（要求のみ / 設計まで / タスクまで）をユーザーに確認する
- 同一ステップで `NO-GO` が **2回連続** した場合、調整者は停止し、ユーザーと方針の再合意を求める
- 更新フロー（要求更新・設計更新）では、**変更差分に関係しない downstream 成果物は再生成しない**

## 既存 SDD スキルとの接続

### `/sdd-spec-requirements`（新規 spec の初期化）

要求新規作成では、discovery の **別チャット** のあと `/sdd-orchestrate <feature>` が **必ず** `/sdd-spec-requirements <feature>` を dispatch する（`brief.md` があっても init で `spec.json` を確定する）。

| スキル | タイミング | 前提 | 成果物 |
| ------ | ---------- | ---- | ------ |
| `/sdd-discovery` | フロー開始（orchestrate より前・別会話） | なし | Path 判定、`brief.md`（Path C/D/E）、必要なら `roadmap.md` |
| `/sdd-spec-requirements <feature>` | 要求新規作成の最初の生成 | `brief.md` があれば読み込む | `spec.json`, `requirements.md`（プロジェクト記述のみ → 続けて EARS 本文） |

**スキップ条件**: `docs/specs/<feature>/spec.json` が既に存在し `phase` が `initialized` 以降なら、init はスキップして requirements から再開できる。

### Path B（直接実装フロー）

Path B は spec を作成・更新しない。調整者は discovery が Path B と判定したら **直接実装フロー** に入る。

1. [調整者]: `/sdd-discovery` を実行。Path B と判定されたら spec フローには入らない
2. [実装者]: メインコンテキストで直接実装（`/sdd-impl` は **呼ばない** — `ready_for_implementation` spec がないため）
3. [調整者]: 完了宣言前に `/sdd-verify-completion` を適用（claim type: `FIX` または `TEST_OR_BUILD`）
4. [調整者]: 変更内容をユーザーに報告し、完了を確認

**Path B で使わないもの**: `spec.json` ゲート、`/sdd-impl`、`/sdd-validate-impl`、`/sdd-review`（タスク単位）。必要に応じて `/sdd-review` 相当の軽量チェックは調整者が手動で行ってもよいが、必須ではない。

**Path B と「実装のみフロー」の違い**

| | Path B 直接実装 | 実装のみフロー |
| - | --------------- | -------------- |
| spec | なし | 既存 spec あり |
| 前提 | discovery Path B | `ready_for_implementation: true` |
| 実装手段 | メインコンテキスト直接 | `/sdd-impl <feature>` |
| 完了検証 | `/sdd-verify-completion` | `/sdd-impl` 内 review + `/sdd-validate-impl <feature>` |

### 実装フェーズ内のレビュー（`/sdd-impl` + `/sdd-review`）

spec ベースの実装では、調整者は `/sdd-impl` の内部ループを把握し、feature 検証の前提が満たされているか確認する。

**`/sdd-impl` 内のバッチ／選択ループ**（調整者は impl スキルに委譲するが、停止条件を監視する）

実行モードは `spec.json` の `complexity_tier`（またはタスク数フォールバック）で `direct` / `wave` / `strict` を選ぶ（詳細は `sdd-impl` Step 2）。

1. 次の **major**（または `direct` 選択）を組み、実装（サブエージェントまたは親）が TDD → `READY_FOR_REVIEW`
2. 親が機械チェック（テスト / TBD / Secrets / Boundary / RED）→ FAIL なら reviewer を呼ばず差し戻し
3. 通過後、レビューが `/sdd-review` で判断レビュー（バッチ／選択単位）→ `APPROVED` / `REJECTED`
4. `APPROVED` 後、`[x]` 直前に `/sdd-verify-completion` を **1 回**（claim type: `BATCH`、単一手動タスクのみ `TASK`）で fresh evidence 確認 — 中間 `APPROVED` ごとには呼ばない
5. バッチ／選択内タスクをまとめて `[x]` にし、選択的 git commit
6. `REJECTED` / 機械 FAIL は最大 2 回リトライ → 失敗時 `/sdd-debug`（fresh）→ それでも失敗なら `_Blocked:_` で停止

**調整者の関与**

- 全タスク `[x]` になるまで `/sdd-validate-impl` へ進めない
- `_Blocked:_` タスクが残ったら停止し、ユーザーに報告
- autonomous mode では impl 完了後に自動で `/sdd-validate-impl <feature>` が走る（手動 mode では調整者が明示 dispatch）
- feature 終端では `/sdd-validate-impl` GO 後に `/sdd-verify-completion`（`FEATURE_GO`）を適用する

### 既存 validate との棲み分け

| 既存スキル | フェーズ | 本フローでの位置づけ |
| ---------- | -------- | -------------------- |
| `requirements-review-gate`（`sdd-spec-requirements` 内蔵） | 要求生成**前** | 機械チェック + ドラフト品質。対話的合意は担当しない |
| `/sdd-spec-design <feature>` | 設計生成 | brownfield はスキル内で gap。greenfield は gap スキップ |
| `/sdd-validate-design-qa --only final` | 設計 validate **最終（AI-DLC）** | qa/arch/sec のレポートを入力に総合 GO/NO-GO → `reviews/design-review.md`。専門分析は繰り返さない |
| `/sdd-validate-impl <feature>` | 実装完了後 | タスク横断の統合検証。バッチ／選択単位の判断レビューは `/sdd-review` の責務 |
| `/sdd-verify-completion` | 各 GO 宣言前 | fresh-evidence ゲート。調整者が各フェーズゲートと impl のバッチ／選択完了・`FEATURE_GO` で適用 |

### brownfield オプション

既存コードベースへの変更で、要求新規作成・要求更新フローの場合:

- brownfield のギャップ分析は `/sdd-spec-design <feature>` の中で一度だけ走る（standalone の gap ステップは無い）
- greenfield では gap をスキップする（`sdd-orchestrate/rules/greenfield.md`）

## スキル実装状況

実行の詳細は各 `SKILL.md`。この表は入口だけ示す。

| スキル | パス | 概要 |
| ------ | ---- | ---- |
| `/sdd-discovery` | `.agents/skills/sdd-discovery/` | Path 判定、`brief.md` / `roadmap.md`。orchestrate しない |
| `/sdd-orchestrate <feature>` | `.agents/skills/sdd-orchestrate/` | フロールーティング、フェーズゲート、巻き戻し。`<feature>` 必須。手順は `rules/` |
| `/sdd-impl <feature>` | `.agents/skills/sdd-impl/` | `ready_for_implementation: true` の TDD 実装。`<feature>` 必須 |
| `/sdd-steering` | `.agents/skills/sdd-steering/` | steering 同期。完了 spec の retention と、確認後のディレクトリ削除 + roadmap から名前削除 |

### validate スキル（統合 2 本）

共通契約: `.agents/skills/sdd-validate-shared/contract.md`（各 validate スキルから参照。重複読込み回避）

| スキル | 担当役割 | 概要 |
| ------ | -------- | ---- |
| `/sdd-validate-requirements` | プロダクトオーナー / 品質 / セキュリティ | 統合 validate（Pass A po→qa→sec + Pass B final + Phase Gate）→ `requirements-review.md`。`--only po\|qa\|sec\|final` 可 |
| `/sdd-validate-design-qa` | 品質 / アーキテクト / セキュリティ / 設計者 | 統合 validate（Pass A qa→arch→sec + Pass B final + Phase Gate）→ `design-review.md`。`--only qa\|arch\|sec\|final` 可 |

## validate スキル契約

### 共通規約

**レビューレポートの配置**

```
docs/specs/<feature>/reviews/
├── requirements-review.md  # /sdd-validate-requirements（canonical）
└── design-review.md        # /sdd-validate-design-qa（canonical）
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
（自律的に確定した判断・前提・トレードオフ。PR Summary / 残リスクの原文）

## Evidence
（参照したファイルパス・チェック項目）
```

調整者は `VERDICT:` フィールドのみを機械的ゲート判定に使う（`/sdd-impl` の `STATUS` / `VERDICT` パースと同様）。

**`/sdd-verify-completion` との関係**

- 各 validate スキルが `GO` を宣言する前に、スキル内で fresh evidence（ファイル存在・内容整合）を確認する
- 調整者は **要求・設計** では統合レポートの Phase Gate `STATUS: VERIFIED` を用い、オーケストレーション中は `/sdd-verify-phase-gate` を dispatch しない（タスクは `/sdd-verify-phase-gate`）
- **実装フェーズ**完了時（`/sdd-validate-impl` GO 後）は `/sdd-verify-completion`（`FEATURE_GO`）を適用する

### 要求フェーズ validate

| スキル | 入力 | 出力・副作用 | やらないこと |
| ------ | ---- | ------------ | ------------ |
| `/sdd-validate-requirements` | `requirements.md`, `brief.md`, steering | `reviews/requirements-review.md`（Specialist Summaries / Gap-Domain Audit / 承認ゲートサマリ / Phase Gate）。必要なら `requirements.md` を自律的に修正。**`## Decisions`** に判断・前提・トレードオフを記録 | EARS 機械チェック（`requirements-review-gate` の領域）、**ユーザーとの対話** |

**実行**: 単一スキル内で Pass A（po→qa→sec）→ Pass B（final + Phase Gate）→ `requirements-review.md` を書く。部分再実行は `--only po|qa|sec|final`。

**直列必須の理由**: 各専門サブパスの指摘は `requirements.md` に反映される。次のサブパスは **直前で更新された `requirements.md`** を入力とする。

**自律実行の原則**

- validate 中はユーザーに質問しない。曖昧さは合理的な前提で補い、`## Decisions` に記録する
- 前提を置けず進められない場合は `VERDICT: NO-GO` または `MANUAL_VERIFY_REQUIRED` とし、停止してユーザーに判断を求める（validate 中の対話は行わない）

**`requirements-review-gate` との棲み分け**

| | `requirements-review-gate`（生成前） | `/sdd-validate-requirements`（生成後） |
| - | ------------------------------------ | --------------------------------------- |
| 目的 | 書き込み前のドラフト品質・EARS 機械適合 | 生成後の意味的整合・曖昧さの自律的解消 + gap 監査 |
| 形式 | 内部ループ（最大 2 パス） | 自律実行（対話なし）。判断はレポート `## Decisions` に記録 |
| 成果物 | `requirements.md` 初版 | `reviews/requirements-review.md` + 必要な修正 |
| ユーザーへの報告 | なし（生成スキル内で完結） | レポートの `## Decisions` / 承認ゲートサマリ（PR Summary が参照） |

### 設計フェーズ validate

| スキル | 入力 | 出力 | やらないこと |
| ------ | ---- | ---- | ------------ |
| `/sdd-validate-design-qa` | `requirements.md`, `design.md`, steering | `reviews/design-review.md`（Specialist Summaries / Gap-Domain Audit / 承認ゲートサマリ / Phase Gate）。指摘の `design.md` 反映 | ユーザー対話 |

**実行**: 単一スキル内で Pass A（qa→arch→sec）→ Pass B（final + Phase Gate）→ `design-review.md` を書く。部分再実行は `--only qa|arch|sec|final`。

**直列必須の理由**: 各専門サブパスの指摘は `design.md` に反映される。次のサブパスは **直前で更新された `design.md`** を入力とする。

**実行順**: `spec-design` → `validate-design-qa` → Phase terminal → **次チャット**で `spec-tasks`

## Spec クリーンアップ

実装完了後の削除は `/sdd-steering`（確認付き）。`--steering-only` では retention / cleanup をスキップする。

1. 完了 spec の Implementation Notes を `docs/steering/` へ移す（retention）
2. ユーザー確認後、`docs/specs/{feature}/` を削除する
3. その spec 名を `docs/steering/roadmap.md` から外す（自身の行と、他 spec の `Dependencies:`）

削除済みの spec 名は roadmap に残さない。追跡できない名前が残ると、後続の discovery がそれを upstream にして orchestrate が止まる。

削除してよいのは当該 feature ディレクトリのみ。次は消さない:

- `docs/architecture/**`
- `docs/contracts/**`
- `docs/architecture/adr/**`

永続知は retention 先の steering と、設計時の architecture / contracts / ADR。

## 設計 validate の役割分担

詳細な入出力契約は「validate スキル契約」を参照。ここでは実行順と責務の概要のみ示す。

| スキル | 状態 | 担当役割 | 概要 |
| ------ | ---- | -------- | ---- |
| `/sdd-validate-design-qa` | 実装済 | 品質 / アーキテクト / セキュリティ / 設計者 | 統合 Pass A→B→C → `reviews/design-review.md`。`--only` で部分再実行可 |

**実行順**

1. `/sdd-spec-design` で設計書を生成
2. `/sdd-validate-design-qa` を実行（スキル内で qa→arch→sec→final+phase-gate）
3. `design-review.md` が `VERDICT: GO` かつ Phase Gate `VERIFIED` なら会話終了。タスク生成は同じ checkout の次チャット

## 基本的な開発フロー

フロー開始前に `/propose-quality-tools` の実行を推奨する（詳細は「SDD 実施前の推奨」）。M/L は下のチャット境界で切る。S（quick-path）は要求+設計+タスクが 1 チャット。

[調整者]: `/sdd-orchestrate <feature>` で下記を回す。要求・設計は統合レポートの Phase Gate `VERIFIED` 後に Phase Handoff を出す（`go` 待ちなし）。人間が成果物を確認し、問題があれば同じチャットで修正、問題がなければ新しいチャットで `/sdd-orchestrate <feature>`。タスクは `/sdd-verify-phase-gate <feature> tasks` VERIFIED 後に `ready_for_implementation: true` を立て、PR Summary を出す（`/sdd-impl` には自動で進まない）。実装は明示的 `実装のみ`。

### 要求新規作成の場合（M/L）

**チャット 1 — Discovery（orchestrate しない）**

1. `/sdd-discovery`。Path C/D/E なら `docs/specs/<feature>/brief.md` を書く
2. 次が別 checkout なら、ここで commit（置き場所は「起動規則」）

**チャット 2 — 要求**（同じ checkout で `/sdd-orchestrate <feature>`）

1. `/sdd-spec-requirements <feature>`（init + EARS。内部で `requirements-review-gate`）
2. `/sdd-validate-requirements <feature>` → `reviews/requirements-review.md`
3. Phase Gate VERIFIED → Phase Handoff（設計へ進まない。人間が確認し、OK なら次チャット）

**チャット 3 — 設計**（同じ checkout で `/sdd-orchestrate <feature>`）

1. `/sdd-spec-design <feature>`（brownfield は inline gap）
2. `/sdd-validate-design-qa <feature>` → `reviews/design-review.md`
3. Phase Gate VERIFIED → Phase Handoff（タスクへ進まない。人間が確認し、OK なら次チャット）

**チャット 4 — タスク**（同じ checkout で `/sdd-orchestrate <feature>`）

1. `/sdd-spec-tasks <feature>`
2. `/sdd-verify-phase-gate <feature> tasks`
3. `ready_for_implementation: true` → PR Summary → 終了

**チャット 5 — 実装**（同じ checkout で `/sdd-orchestrate <feature> 実装のみ` または `/sdd-impl <feature>`）

1. `/sdd-impl <feature>`（major 単位: 親 mechanical → `/sdd-review` → `/sdd-verify-completion`（`BATCH` / 単一 `TASK`）→ `[x]`）
2. `/sdd-validate-impl <feature>`
3. `/sdd-verify-completion`（`FEATURE_GO`）→ 終了

### 要求更新の場合

Discovery のあと `/sdd-orchestrate <feature>`。要求の Phase Handoff 後に人間が確認し、OK なら同じ checkout の新しいチャットで設計 →（また確認）→ タスク。コマンドはいずれも `<feature>` 付き。更新は差分のみ。

### 要求更新不要、設計更新の場合

Discovery のあと `/sdd-orchestrate <feature>`（設計から）。設計の Phase Handoff 後に人間が確認し、OK なら同じ checkout の新しいチャットでタスク生成まで。

### 実装のみの場合（既存 spec・`ready_for_implementation: true`）

1. 必要なら `/sdd-discovery`（Path A で実装のみ）
2. `/sdd-orchestrate <feature> 実装のみ`（または `/sdd-impl <feature>`）。`ready_for_implementation: true` でなければ停止
3. `/sdd-validate-impl <feature>` → `/sdd-verify-completion`（`FEATURE_GO`）→ 終了

### Path B 直接実装の場合（spec なし）

1. `/sdd-discovery`。Path B なら spec フローに入らない（`/sdd-orchestrate` も `/sdd-impl` も使わない）
2. メインコンテキストで直接実装する
3. `/sdd-verify-completion`（`FIX` または `TEST_OR_BUILD`）
4. 変更内容を報告し、完了を確認する
