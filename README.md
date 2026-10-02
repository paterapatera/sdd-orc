# sdd-orc3

AIエージェントに issue の実装を任せるための、仕様駆動開発（SDD）のスキル集。
Cursor などで使える `.agents/skills/` の形式で書いている（Claude Code 専用にはしない）。

人が関わるのは **要件（受け入れ条件）の確認** と **受け入れテスト** の2か所だけで、人のコードレビューは行わない。
コードの品質は、品質ゲート（フォーマッタ、lint・型チェック、テスト）で担保する。

## 特徴

- **issue から始める。** issue を `docs/specs/<issue>/issue.md` に取り込み、spec の正本はローカルのファイルにする（issue との双方向の同期はしない）。
- **spec は TypeScript で書き、AI だけが読む。** 人は spec から生成した HTML を読む。
- **spec は作業ブランチの中にだけ置く。** マージする前に削除し、main には一度も入れない。長く残す知識は、完了時に恒久ドキュメント（`docs/sdd/`）へ移す。
- **AI が飛ばせない部分を道具で確かめる。** 型チェックと検証スクリプトで、ID の参照、要件と設計・タスクの対応漏れ、受け入れ条件のテスト漏れ、品質ゲートを緩めた変更などを機械的に検出する。
- **案件を選ばない。** 言語（TypeScript、Python、Rust、PHP など）、issue トラッカー（Redmine、JIRA、GitLab、GitHub など）、CI の有無を問わない。道具は Deno で動くので、対象リポジトリに `package.json` や `node_modules` は増えない。

## 前提

| 項目 | 内容 |
|---|---|
| 実行環境 | Deno 2 以上（https://docs.deno.com/runtime/getting_started/installation/） |
| AI のツール | `.agents/skills/` を読めるもの（Cursor で動作を確認済み） |
| Git | squash マージで取り込む運用 |
| ホスティングの CLI（任意） | `gh` / `glab` / `fj` / `tea`。登録すると issue の取得、PR/MR の作成、squash マージを CLI で行う |

## スキル

| スキル | 役割 | モード |
|---|---|---|
| `sdd-init` | プロジェクトへの導入と更新。新規案件は対話で、既存案件はコードの解析で、恒久ドキュメントを作る | 共通 |
| `sdd-start` | issue の取り込み → 規模の判定 → モードの選択 → ブランチの作成 → 衝突の確認 | 共通 |
| `sdd-req` | issue から要件（機能要件、非機能要件、変えてはいけない振る舞い）を作る | 完全 |
| `sdd-design` | 要件から設計を作る。影響範囲の衝突も確かめる | 完全 |
| `sdd-tasks` | 要件と設計から実装タスクを作る | 完全 |
| `sdd-quick` | 期待する動作、原因、方針、タスクを1ファイルにまとめて作る | 軽量 |
| `sdd-impl` | タスクを1件ずつ、品質ゲートを通しながら、止まらずに完了まで実装する | 共通 |
| `sdd-finish` | 受け入れテストの合格後に、恒久ドキュメントへの反映 → spec の削除 → PR/MR の作成 | 共通 |
| `propose-quality-tools` | 言語と規模に合った品質ツール（フォーマッタ、型、SOLID、境界の規則）を提案する。`sdd-init` から使う | — |

スキルは、人が明示的に呼び出したとき（`/sdd-start` など）だけ動く。

## 使い方

### 導入する

1. このリポジトリの `.agents/skills/` を、対象リポジトリの `.agents/skills/` にコピーする。
2. 対象リポジトリで `/sdd-init` を実行する。`docs/sdd/` に道具（型定義、検証スクリプト、HTML の生成、AI 向けの手引き）が入り、pre-commit hook が設置され、恒久ドキュメント（構成、規約、非機能要件、ADR）が作られる。
3. 作られたものを通常の PR で main に入れる。
4. 2人目以降のメンバーは、pre-commit hook だけを設置する。

   ```sh
   deno run --allow-read --allow-write --allow-run=git .agents/skills/sdd-init/scripts/install.ts --hook-only
   ```

新規案件では、機能の開発の前に **基盤issue**（雛形、共通の部品、品質ツールとテスト、画面の土台を作る issue）を1人で進め、マージしてから並行開発を始める。

スキルを更新したときは、新しい `.agents/skills/` をコピーしてから `/sdd-init` をもう一度実行すると、道具が新しい版に置き換わる（恒久ドキュメントには触れない）。

### 完全モード（新機能、大きな仕様変更）

```
1. /sdd-start    issue を取り込み、feature/<小文字の issue ID>-<slug> ブランチを作る
2. /sdd-req      requirements.ts を作る ── 人が要件（受け入れ条件）を HTML で確認する
3. /sdd-design   design.ts を作る（要件などから決められない設計上の選択だけを質問する）
4. /sdd-tasks    tasks.ts を作る（人の確認なし）
5. /sdd-impl     1タスク＝1コミットで、品質ゲートを通しながら完了まで実装し、受け入れテストの準備をする
                 ── 人が受け入れテストを行う。不合格ならチャットで伝え、/sdd-impl で直す
6. /sdd-finish   恒久ドキュメントへの反映、spec の削除、PR/MR の作成
7. squash マージ
```

### 軽量モード（完全モードで作った機能の、後の修正）

```
1. /sdd-start    規模の判定で軽量モードを選ぶ
2. /sdd-quick    ── 人が期待する動作と受け入れ条件を確認する ── spec.ts を作る
3. /sdd-impl     最初のタスクで再現テストを書き、失敗することを確かめてから直す
                 ── 人が受け入れテストを行う
4. /sdd-finish → squash マージ
```

モードは `sdd-start` が判定して提案し、担当者が決める。目安は次のとおり。

| 観点 | 軽量モード | 完全モード |
|---|---|---|
| 種類 | バグの修正、小さな仕様変更 | 新機能、仕様の大きな変更 |
| 影響範囲 | 1つのモジュールの中 | 複数のモジュールにまたがる |
| 公開 API、DB のスキーマ、依存ライブラリ | 変えない | 変える |
| タスク数 | 3件以下 | それ以上 |

### 人がすること

- **要件の確認**: 生成された HTML（`.sdd/out/<issue>/index.html`）を読み、指摘があればチャットで AI に伝える。
- **受け入れテスト**: HTML の「受け入れテスト」の章にあるチェックリストを、起動の手順・テスト用のアカウント・データに沿って確かめる。
- スキルが質問したとき（各スキルの「確認ポイント」）に答える。それ以外では、AI は止まらずに進める。

## 対象リポジトリに作られるもの

```
<対象リポジトリ>/
├── .agents/skills/              # スキル本体（このリポジトリからコピーしたもの）
├── docs/
│   ├── sdd/                     # 恒久（main に入れる）
│   │   ├── config.ts            # トラッカー、ブランチの接頭辞、品質ゲートのコマンドなど
│   │   ├── architecture.ts      # 構成
│   │   ├── conventions.ts       # 規約
│   │   ├── nfr.ts               # プロジェクト全体の非機能要件
│   │   ├── adr/                 # 設計判断の記録
│   │   ├── schema/ scripts/ render/ guides/ deno.json   # SDD の道具（sdd-init が上書きで管理する）
│   └── specs/<issue>/           # 作業中だけ置く（ブランチの中だけ。マージ前に削除）
│       ├── issue.md
│       ├── requirements.ts、design.ts、tasks.ts   # 完全モード
│       └── spec.ts                                # 軽量モード
└── .sdd/out/<issue>/index.html  # 人向けの HTML（.gitignore の対象）
```

道具は `deno task --config docs/sdd/deno.json <タスク名>` で実行する（`check`、`verify`、`render`、`doctor`、`gate` など）。
pre-commit hook は spec のファイルがステージされたときだけ動くので、SDD を使わないメンバーには影響しない。

## このリポジトリの構成

```
.agents/skills/
├── sdd-init/
│   ├── assets/sdd/          # 対象リポジトリの docs/sdd/ にコピーする道具
│   ├── assets/templates/    # 恒久ドキュメントのひな形
│   ├── references/          # 新規案件・既存案件での進め方、hook の組み込み、ツールの選定
│   └── scripts/install.ts   # 道具のコピーと hook の設置
├── sdd-start/ sdd-req/ sdd-design/ sdd-tasks/ sdd-quick/ sdd-impl/ sdd-finish/
└── propose-quality-tools/
tests/                       # 道具のテスト（fixtures/ にサンプルの spec）
```

## 開発

```sh
deno task test    # すべてのテスト
deno fmt --check
deno lint
```

変更のしかたは [AGENTS.md](AGENTS.md) を参照。

## 未決事項

- スキルを各リポジトリへ配る方法（今は手でコピーする。更新と版の管理）
- Cursor 以外のツールでの `.agents/skills/` と `disable-model-invocation` への対応状況
- issue トラッカーとの自動連携（今は issue の内容を手で渡す）
- `sdd-render`（前回の確認からの変更点の表示）と `sdd-status`（今の工程と次にすべきことの表示）の作成
