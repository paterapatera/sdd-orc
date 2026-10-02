---
name: sdd-init
description: SDD（仕様駆動開発）をリポジトリに導入、または更新する。docs/sdd に型定義・検証スクリプト・HTML生成の道具を組み込み、新規案件は対話で、既存案件はコードの解析で、構成（architecture）・規約（conventions）・非機能要件（nfr）を作る。ユーザーが sdd-init の実行を明示的に指示した場合にだけ使う。
disable-model-invocation: true
---

# sdd-init

SDDの土台を対象リポジトリに組み込み、恒久ドキュメント（`docs/sdd/`）を作る。
導入済みのリポジトリで実行した場合は、道具を最新の版に更新する。

このスキルのファイル:

- `scripts/install.ts`: 道具のコピー、`.gitignore` への追記、pre-commit hook の設置を行う
- `assets/sdd/`: 対象リポジトリの `docs/sdd/` にコピーされる道具（型定義、検証スクリプト、HTML生成、書き方の手引き）
- `assets/templates/`: 恒久ドキュメントのひな形
- `references/new-project.md`: 新規案件での恒久ドキュメントの作り方
- `references/existing-project.md`: 既存案件での恒久ドキュメントの作り方
- `references/hook-integration.md`: 既存のhook管理（husky など）への組み込み方
- `references/tooling.md`: ツールの選定（品質、テスト、規約の強制）

以下、`<SKILL_DIR>` はこのスキルのディレクトリ（例: `.agents/skills/sdd-init`）を指す。
コマンドはすべて対象リポジトリのルートで実行する。

## 確認ポイント

sdd-init はプロジェクトの前提を決める一度きりの作業なので、他のスキルより確認が多い。
ユーザーの回答を待つのは次の場合で、それぞれ質問を示して返答を終え、回答を受け取ってから先に進む。

1. **前提**（手順1）: Gitリポジトリでない場合の `git init`、未コミットの変更の扱い、作業ブランチの作成
2. **道具の組み込み**（手順3）: `--dry-run` の結果。既存のhook管理への組み込み
3. **案件の種類**（手順4）: 新規案件か既存案件か
4. **恒久ドキュメントの内容**（手順4の手順書）: 新規案件では対話で決める項目、既存案件では分からなかった項目の質問
5. **コミット**（手順6）

質問ツール（Cursor の AskQuestion など）があれば必ず使う（文章だけで質問しない）。事務的な確認は1回にまとめてよいが、
恒久ドキュメントの内容（技術スタック、構成、画面とデザイン、規約、品質ゲート、非機能要件）は、回答によって次の質問が変わるので
**1回の呼び出しに1問だけ**入れる（試行で、2〜3問をまとめて聞いていた）。
スキルを呼び出したこと（`/sdd-init`）は、確認ポイントへの回答ではない。

## 1. 前提を確認する

1. Gitリポジトリのルートにいることを確認する（`git rev-parse --show-toplevel`）。
   Gitリポジトリでなければ、`git init` してよいか、既定のブランチ名（推奨は `main`）をユーザーに確認し、
   `git init -b <既定のブランチ名>` で作る。
2. `deno --version` を実行する。Deno が無ければ、次のインストール方法を案内して**止まる**。
   黙って先に進めない。
   - https://docs.deno.com/runtime/getting_started/installation/
   - Deno 2 以上が必要。
3. `git status --porcelain` で作業ツリーを確認する。未コミットの変更があれば、続けてよいかをユーザーに確認する。
4. 既定のブランチ（main など）にいる場合は、作業ブランチ（例: `feature/sdd-init`。ブランチ名はすべて小文字）を作ってよいかを確認して作る。
   恒久ドキュメントは通常のPR/MRで main に入れる。

## 2. 導入済みかを判定する

- `docs/sdd/config.ts` がある → **更新**。手順3を行い、手順5（型チェック）を経て手順6へ進む。
  恒久ドキュメント（architecture、conventions、nfr、adr）は作り直さない。
  型定義の更新で恒久ドキュメントに型エラーが出たら、既存の内容は変えずに、新しく必須になった項目だけを足す。
  例: 0.6.0 では規約（conventions.ts）に `enforcedBy` が必須になった。各規約が品質ゲートのツールで強制されているかを
  設定ファイル（deptrac.yaml、phpstan.neon、ESLint の設定など）で確かめ、`"gate"`（と `tool`）か `"manual"` を書く。
  判断できない規約はユーザーに聞く。
  0.8.0 では、`enforcedBy: "gate"` の規約に `config`（設定ファイルやテストのパス）が必須になった。実在するものだけを書き、
  実在しないなら manual に戻す。あわせて `config.ts` に `ui`（画面があるか）を登録する。
- 無い → **新規の導入**。手順3から順に行う。

## 3. 道具を組み込む

1. まず変更内容だけを確認する:
   ```sh
   deno run --allow-read --allow-write --allow-run=git <SKILL_DIR>/scripts/install.ts --dry-run
   ```
2. 表示された内容をユーザーに伝え、実行してよいかを確認する。更新の場合、`[削除]` や `[更新]` があれば必ず伝える。
3. 実行する:
   ```sh
   deno run --allow-read --allow-write --allow-run=git <SKILL_DIR>/scripts/install.ts
   ```
4. 終了コードが2（要対応）の場合は、表示された内容に従う。
   既存のhook管理がある場合は `references/hook-integration.md` を読み、
   どのファイルにどう追加するかをユーザーに示して、了承を得てから追加する。

## 4. 案件の種類を判定する（新規の導入のときだけ）

次の材料から「新規案件」か「既存案件」かを提案し、**ユーザーに決めてもらう**。

- `git rev-list --count HEAD`（コミットが無ければ新規案件の可能性が高い）
- ソースコードの量（`git ls-files | wc -l` など）

決まったら、該当する手順書を読んでその手順に従う。

- 新規案件 → `references/new-project.md`
- 既存案件 → `references/existing-project.md`

恒久ドキュメントのひな形は `<SKILL_DIR>/assets/templates/` にある。
`architecture.ts`、`conventions.ts`、`nfr.ts` は `docs/sdd/` に、ADRは `docs/sdd/adr/` に置く。

### ツールの選定（どちらの案件でも行う）

人はコードレビューを行わず、コードの品質と画面の正しさはツール（品質ゲート）で担保する。
技術スタックが決まったら、**ユーザーに頼まれなくても** `references/tooling.md` の手順で次の3つを選定し、1つの提案として確認してもらう。

1. 品質ツール（propose-quality-tools を自分で実行する。言語ごとの規模はユーザーに聞く）
2. テストのツール（単体・結合、画面があるなら E2E）
3. 規約を強制するツール（手で守るしかない規約を、品質ゲートで検出できるようにする）

採用したら、次を行う。

- 採用したツールと使い方を `conventions.ts` に規約として、選定の理由を ADR として記録する。
- 規約（`conventions.ts`）には、品質ゲートで強制しているか（`enforcedBy: "gate"`、ツール、`config` に設定ファイルやテストのパス）、
  手で守るか（`"manual"`）を書く。**まだ存在しないツールや設定で gate と書かない**（doctor が `config` の存在を確かめる）。
  基盤issueで導入する予定なら、導入するまで manual にしておき、導入したissueで gate に変える。
- 品質ゲートでテストを除外しない（`SKIP_` の環境変数、`--exclude-group` など）。`doctor` が警告する。
- `commands` には `format`（自動整形）、`check`（書き換えない品質ゲートをまとめたもの）、`test`、画面があれば `e2e` を登録する。
  check をまとめたコマンドが無ければ `lint`、`typecheck` を個別に登録する。
- まだツールを導入していない場合（新規案件）は、`commands` は空のままにし、導入を基盤issueに含める。

### 画面の有無（どちらの案件でも行う）

画面（Web の UI）があるかをユーザーに確かめ、`docs/sdd/config.ts` の `ui` に登録する。true なら E2E テスト（`commands.e2e`）が必須になり、
人が確かめる受け入れ条件は E2E のタスクでも確かめる（verify と doctor が確かめる）。

### 画面とデザインの方針（画面がある場合。どちらの案件でも行う）

画面の作り方を決めずに issue のフローを始めると、issue ごとにばらばらの部品やスタイルで作られ、後から統一するのが難しい。
新規案件では対話で決め、既存案件ではコードから今のやり方を調べて確認してもらう（手順は各手順書）。
決めた内容は `conventions.ts`（使い方の規約）と ADR（ライブラリの選定理由）に記録する。

### ホスティングのCLIと issue のID（どちらの案件でも行う）

- 使っているホスティングのCLIを調べる（`gh`、`glab`、`fj`、`tea` のどれが使えるか。`git remote -v` の URL も手がかりにする）。
  ユーザーに確かめたうえで、`docs/sdd/config.ts` の `forge` に登録する（例: `forge: { cli: "fj" }`）。
  使い方は `docs/sdd/guides/forge.md` にある。
- **資格情報を取り出してAPIを直接呼ばない**（`git credential fill`、トークンの読み出し、curl での API 呼び出しなど）。
- issue のIDに付ける接頭辞（例: `FJ`、`GH`）が決まっていれば、`docs/sdd/config.ts` の `issueIdPrefix` に登録する。

## 5. 型チェックを通す

恒久ドキュメントを書いたら、毎回次を実行し、エラーが無くなるまで直す。

```sh
deno task --config docs/sdd/deno.json check
```

## 6. 確認してコミットする

1. `deno task --config docs/sdd/deno.json doctor` を実行し、必須の項目に問題が無いことを確かめる。
   （architecture.ts などが無いという警告は、更新のときに恒久ドキュメントをまだ作っていない場合に出る。
   品質ゲートが未設定という警告は、新規案件で基盤issueの前なら想定どおり）
2. ユーザーに次を報告する。
   - 追加・変更したファイルの一覧
   - 恒久ドキュメントの要点（技術スタック、モジュール、層のルール、画面とデザインの方針、規約の件数、非機能要件の件数、品質ゲートとテストのツール）
   - 分からなかったため書かずにおいた項目と、ユーザーへの質問
3. ユーザーの了承を得てからコミットする。コミットメッセージの例:
   - 新規の導入: `SDDを導入（docs/sdd）`
   - 更新: `SDDを <版> に更新`
4. 通常のPR/MRで main に入れるよう案内する（`forge` を登録していれば、了承を得てCLIで作ってよい。マージの方式は squash を指定する）。
5. 他のメンバーへの案内を伝える。pre-commit hook はコミットされないので、
   SDDを使うメンバーは各自で次を実行する必要がある。
   ```sh
   deno run --allow-read --allow-write --allow-run=git <SKILL_DIR>/scripts/install.ts --hook-only
   ```

## 7. 次の流れを案内する

sdd-init の後は、**アプリのコードを直接 main にコミットせず、issue を作って sdd-start から進める。**
ユーザーが迷わないよう、次の流れを番号付きで示す。

**新規案件**

1. sdd-init の PR/MR をマージする（squash）。
2. 基盤issue（機能の開発の前に、雛形・共通の部品・品質ツールとテスト・画面の土台を作るissue）を issueトラッカーに作る。
   文面は `references/new-project.md` の「基盤issueを案内する」で作ったもの。
   `forge` を登録していれば、了承を得てCLIで作ってよい（`docs/sdd/guides/forge.md`）。
3. 基盤issueを `/sdd-start <issue の番号>` から完全モードで進める（品質ツール、テストのツール、画面の土台の導入もこのissueで行う）。
4. 基盤issueをマージしてから、機能のissueの並行開発を始める。

**既存案件**

1. sdd-init の PR/MR をマージする（squash）。
2. 最初に取り組むissueを選び（ツールの導入を別のissueにした場合は、それも候補）、`/sdd-start <issue の番号>` から進める。

sdd-init の後に恒久ドキュメントを直す場合（規模の変更、規約の追加など）も、main に直接コミットせず、作業ブランチと PR/MR で入れる。

## 守ること

- 恒久ドキュメントの項目を**推測で埋めない**。分からない項目は書かずにおき、ユーザーへの質問として挙げる。
- 更新のときは、恒久ドキュメントの既存の内容を消したり作り直したりしない。
- 接続文字列、パスワード、APIキーなどの秘密情報を恒久ドキュメントに書かない。
- `docs/sdd/` の道具（`schema/`、`scripts/`、`render/`、`guides/`、`deno.json`）は手で編集しない。
  変更が必要なら、配布元の `assets/sdd/` を直して sdd-init で更新する。
