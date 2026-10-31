# sdd-orc

[English](README.md)

sdd-orc は Cursor・Codex・Claude Code から [仕様駆動開発（SDD）](https://github.com/paterapatera/sdd-orc) を進めるためのエージェント用スキルと、共通の検査スクリプトをリポジトリに入れるパッケージです。チャットで `/sdd-init` や `/sdd-req` などのスキルを呼び出すと、エージェントが Markdown を書き、検査は各スキルがスクリプト経由で実行します。パッケージ名は `@paterapatera/sdd-orc` 1.0.0 です。Node.js 18 以降が必要です。

issue の登録、プルリクエストの作成、`Closes #1` の記述は別のトラッカー連携スキルの範囲です。このパッケージはトラッカーと通信しません。

## 日常で触るフォルダ

ドキュメントのルートは既定で `docs` です（`npx @paterapatera/sdd-orc init --docs-dir <path>` で変更できます）。

| パス | 意味 |
|---|---|
| `docs/knowledge/` | マージ後も残る仕様・決定記録（ADR）・steering |
| `docs/knowledge/lessons/` | 過去に起きた問題と再発防止の方針（削除せず、状態はここで管理） |
| `docs/issues/<name>/` | ブランチ `<name>` で作業中の変更用ファイル。close 後に削除 |

```text
docs/
  knowledge/          ← 恒久の specs、decision/、steering/、lessons/
  issues/<name>/      ← 変更概要、要件、設計、タスク、feedback（ブランチ上のみ）
```

スキル本文は英語です。Git のブランチ名は issue フォルダ名と同じにしてください（例: ブランチもフォルダも `invoice-fix`、または `PROJ-12-invoice-fix` のようにトラッカーキーを付ける）。

## インストール

```sh
npx @paterapatera/sdd-orc init
```

**インストール後:** まず **エージェントチャット**で `/sdd-steering` を実行します。`docs/knowledge/steering/` の steering ドキュメントを作成します（`init` コマンドでは作りません）。すでにアプリのコードがあるリポジトリでは、コードを読んで steering を合わせます。新規プロジェクトでは初期の steering を作成します。そのあと、変更ごとにベースブランチで `/sdd-init` から始めます。

| オプション | 既定値 |
|---|---|
| `--docs-dir` | `docs` |
| `--lang` | `en` |
| `--base-branch` | `main` |
| `--runtime` | `node` |
| `--skills-dir` | `.agents`（エージェントごとに繰り返す） |

例は次のとおりです。

```sh
npx @paterapatera/sdd-orc init --lang ja --runtime bun --skills-dir .agents --skills-dir .claude
```

`sdd.config.json` を書き、各 `<skills-dir>/skills/` に同じスキルをコピーし、検査スクリプトは最初の skills ディレクトリだけに置きます（例: `.agents/skills/sdd-scripts/sdd.mjs`）。CI でネットワークなしに `check` できるよう、`<skills-dir>` をコミットしてください。

`npx @paterapatera/sdd-orc init` は `docs/knowledge/` の骨組みだけを作ります。`steering/` は作りません（上の **インストール後** を参照）。docs 配下に、このレイアウト外の Markdown があるとコマンドは止まるので、別の `--docs-dir` を指定してください。インストール後に設定を変える場合は `--force` が必要です。

## 更新

```sh
npx @paterapatera/sdd-orc update
npx @paterapatera/sdd-orc migrate
```

`update` はスキルとスクリプトだけを更新し、`knowledge/` は触りません。`migrate` は将来のフォーマット変更用で、現在のフォーマット版 1 では変換はありません。

## スクリプトと status

`check` や `stamp`、`apply`、`renumber`、`index` などは、通常の作業では各スキルが自動で実行します。人が手で叩く必要はありません。

今のフェーズと、次に使うスキルを確認したいときだけ、次を実行します。

```sh
node .agents/skills/sdd-scripts/sdd.mjs status
```

特定の issue や、開いている issue すべてを見る場合は `--issue <name>` や `--all` を付けます。

実装の段階でテストを自動実行したい場合だけ、`sdd.config.json` の任意項目 `testCommand` にコマンドを書きます。

## 同梱スキル

`/sdd-init`、`/sdd-req`、`/sdd-design`、`/sdd-task`、`/sdd-impl`、`/sdd-fix`、`/sdd-close`、`/sdd-quick`、`/sdd-reverse`、`/sdd-steering` です。

## どの流れを選ぶか

`/sdd-init` で変更の概要を書くと、内容から流れを決め、次に使うスキル（例: `/sdd-quick` や `/sdd-req`）を案内します。ブランチを切り、そのスキルから進めます。

```mermaid
flowchart TD
  init["/sdd-init"] --> branch["git checkout -b name"]
  branch --> route{変更の種類}
  route -->|要件や設計を変えない小さな修正| quickPath["/sdd-quick → /sdd-close"]
  route -->|今ある動きを文書にするだけ| revPath["/sdd-reverse → /sdd-close"]
  route -->|機能追加や仕様変更| fullPath["/sdd-req から /sdd-close まで"]
  quickPath --> noteQuick["タスクだけ。要件・設計のドキュメントは書かない"]
  revPath --> noteRev["コードに合わせて要件を追加"]
```

### 通常の機能追加

新しい振る舞いや仕様の変更です。init が `/sdd-req` を案内したあとの流れは次のとおりです。

```mermaid
flowchart LR
  R["/sdd-req"] --> D["/sdd-design"]
  D --> T["/sdd-task"]
  T --> I["/sdd-impl"]
  I --> F{内容のずれ}
  F -->|ある| X["/sdd-fix"]
  X --> I
  F -->|ない| C["/sdd-close"]
```

手順。**エージェントチャット**と書いてある操作はチャット、それ以外はターミナルです。

1. **エージェントチャット:** ベースブランチで `/sdd-init`（変更の概要を作成。ブランチはまだ作らない）。
2. **ターミナル:** `git checkout -b <name>`（init が決めた issue フォルダ名と同じ）。
3. **エージェントチャット:** `/sdd-req` → `/sdd-design` → `/sdd-task` → `/sdd-impl`。各スキルの指示どおりコミットする。ずれたら `/sdd-fix` してから続ける。
4. **エージェントチャット:** `/sdd-close` でベースを取り込み、恒久ドキュメントを更新し、issue フォルダを削除し、PR 用のタイトルと本文を表示する（PR は開かない）。

### 小さな変更（quick）

仕様・steering・決定記録を変えずに済む小さな修正です。上と同じ 1・2 のあと、**エージェントチャット**で `/sdd-quick`（タスクだけ）→ `/sdd-close`。仕様や steering の更新が必要ならそこで止まります。

### 既存の振る舞いの記録（reverse）

**コードにはすでに動きがあるのに、仕様に書かれていない**ときに使います。典型例は既存アプリに SDD を入れた直後（コードから仕様を埋める）、または残したい動きが文書化されていないと気づいたときです。一度に全部を書く必要はありません。重要な機能や、これから手を入れる機能から始めてください。

**`/sdd-steering` との違い:** steering は**プロジェクト全体**の前提（目的、技術、構成など）をまとめます。インストール後に一度行う。reverse は**一つの機能**について、すでにあるコードの動きを `specs/` の要件として残す。機能ごとに `/sdd-init` から繰り返す。

最初から `/sdd-reverse` だけを呼ばないでください。**ベースブランチ**で **エージェントチャット**に、次のような文をそのまま送れます。

```text
/sdd-init 請求書の締め処理の今の動きを仕様に記録したい。コードは変えない。
```

要点は **すでにある動きを文書に残す**ことで、新機能の追加やバグ修正ではないと伝えることです。init が最大 3 問聞く場合も、同じ目的で答えてください。

init が終わると変更の概要を書き、**コードを変えない文書化**として分類し、次のスキルは **`/sdd-reverse`** と案内します。そのあと **ターミナル** `git checkout -b <name>`、**エージェントチャット** `/sdd-reverse` → `/sdd-close`。設計やタスクのドキュメントは省略されることが多く、close でも検査は走ります。

## GitHub の issue と連携して使う場合

GitHub Issues で進捗を管理するときの例です（issue や PR の作成はこのパッケージの範囲外。別のトラッカー連携スキルか手作業）。

1. **エージェントチャット:** ベースブランチで、予定している変更の数だけ `/sdd-init` を実行する。
2. 各変更を GitHub issue として登録する（トラッカースキルまたは手動）。
3. フォルダ名・ブランチ名の先頭に issue 番号やキーを付ける（例: `42-invoice-fix`）。
4. **ターミナル:** ベースブランチへ変更概要をコミットする。
5. **ターミナル:** issue ごとに `git checkout -b <name>`。**エージェントチャット:** スキルを `/sdd-close` まで実行する。PR を開くときは `Closes #42` などで issue と結び付ける（手動またはトラッカースキル）。

## 教訓（lessons）と close

作業中、スキルがブランチ上の `docs/issues/<name>/feedback.md` に短いメモを追記することがあります（日常の仕様作業で人が編集するものではありません）。追記したらブランチにコミットしておき、close の前にメモが消えないようにします。**`/sdd-close`** のとき、エージェントがそのメモを読み、`docs/knowledge/lessons/` への更新を提案します。教訓ページには日付付きの **Occurrence log**（何が起きたか。issue 名は書かない）を残します。**issue フォルダを消す前に、教訓の変更一式を一度だけ承認**し、承認内容は `feedback.md` の `- Lessons:` 行として残します。教訓は削除しません。状態（試行中・却下など）は `lessons/` に残ります。要件や実装のスキルが読むのは **steering だけ**で、lessons は読みません。通常の `check` で教訓ページが変わったとき、索引だけ自動で直ることがあり、そのとき短いメモが出ます。

教訓の対象が steering のとき、close **は steering を書き換えません**。代わりに、そのまま送れる **`/sdd-init ...`** の文を表示するので、**新しい issue** として steering 変更を始めます。ベースを取り込んで **re-close** するとき、同じ教訓ページが競合したら、状態は rejected → ineffective → effective → trial → candidate の順で厳しい方を残し、rejected または ineffective が勝った場合はその Reason を残します。

```mermaid
flowchart LR
  issue["issues/ の feedback"] --> close["/sdd-close"]
  close --> lessons["knowledge/lessons/"]
  close --> steerMsg["表示される /sdd-init"]
  steerMsg --> newIssue["新 issue → steering"]
```

## 人が決めるところ

| スキル | 作業内容 |
|---|---|
| `/sdd-init` | 目的・変更内容・対象外について最大 3 問 |
| `/sdd-req`、`/sdd-design`、`/sdd-reverse`、`/sdd-fix` | 1 ラウンド最大 5 問（スコア付き選択肢） |
| `/sdd-steering` の Resync | 差分を 1 件ずつ承認・却下・保留 |
| `/sdd-impl` | タスク一覧の手動確認項目を実施（自動ではチェックしない） |
| `/sdd-close` | マージ競合の解消、仕様コードの変更確認（求められた場合）、**教訓の更新一式の承認**、PR 文面のコピー |

Quick は質問しません。`/sdd-task` も質問しません。

## プルリクエスト CI（推奨）

```yaml
name: sdd
on:
  pull_request:
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
      - run: node .agents/skills/sdd-scripts/sdd.mjs check
```

このチェックを必須にすることや、マージ前にベースへ追従させることはリポジトリ設定の推奨であり、このパッケージが強制するものではありません。
