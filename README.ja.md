# sdd-orc

[English](README.md)

sdd-orc は Cursor・Codex・Claude Code から [仕様駆動開発（SDD）](https://github.com/paterapatera/sdd-orc) を進めるためのエージェント用スキルと、共通の検査スクリプトをリポジトリに入れるパッケージです。チャットで `/sdd-init` や `/sdd-req` などのスキルを呼び出すと、エージェントが Markdown を書き、マージ前に `check`（スキルが実行することもあります）で体裁を確認します。パッケージ名は `@paterapatera/sdd-orc` 0.3.20 です。Node.js 18 以降が必要です。

issue の登録、プルリクエストの作成、`Closes #1` の記述は別のトラッカー連携スキルの範囲です。このパッケージはトラッカーと通信しません。

## 日常で触るフォルダ

ドキュメントのルートは既定で `docs` です（`init --docs-dir` で変更できます）。

| パス | 意味 |
|---|---|
| `docs/knowledge/` | マージ後も残る仕様・決定記録（ADR）・steering |
| `docs/issues/<name>/` | ブランチ `<name>` で作業中の変更用ファイル。close 後に削除 |

```text
docs/
  knowledge/          ← 恒久の specs、decision/、steering/
  issues/<name>/      ← proposal、requirements、design、task（ブランチ上のみ）
```

スキル本文は英語です。Git のブランチ名は issue フォルダ名と同じにしてください（例: ブランチもフォルダも `invoice-fix`、または `PROJ-12-invoice-fix` のようにトラッカーキーを付ける）。

## インストール

```sh
npx @paterapatera/sdd-orc init
```

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

`init` は `docs/knowledge/` の骨組みだけを作ります。`steering/` は作りません（`/sdd-steering` で作成）。docs 配下に、このレイアウト外の Markdown があると `init` は止まるので、別の `--docs-dir` を指定してください。インストール後に設定を変える場合は `--force` が必要です。

## 更新

```sh
npx @paterapatera/sdd-orc update
npx @paterapatera/sdd-orc migrate
```

`update` はスキルとスクリプトだけを更新し、`knowledge/` は触りません。`migrate` は将来のフォーマット変更用で、現在のフォーマット版 1 では変換はありません。

## 検査スクリプト（参照）

実行例は次のとおりです。

```sh
node .agents/skills/sdd-scripts/sdd.mjs check
node .agents/skills/sdd-scripts/sdd.mjs status [--issue <name>] [--all]
node .agents/skills/sdd-scripts/sdd.mjs stamp --issue <name>
node .agents/skills/sdd-scripts/sdd.mjs apply --issue <name>
node .agents/skills/sdd-scripts/sdd.mjs index
node .agents/skills/sdd-scripts/sdd.mjs renumber [--base main] [--code OLD=NEW]
```

多くはスキルが代わりに呼び出します。手元でよく使うのは `check` と `status` です。

| コマンド | 使う場面 |
|---|---|
| `check` | ドキュメントを直したあと。各スキルの setup、close、実装の段階でも実行 |
| `status` | このブランチや issue の次に使うスキルを確認 |
| `apply` | 通常は `/sdd-close` 経由（issue の内容を `knowledge/` に反映） |
| `stamp` | スキルやエラー表示で、恒久ファイル側が変わったと言われたとき |
| `index` | Re-close で index だけ直すとき |
| `renumber` | Re-close で ID や capability コードがベースとぶつかったとき |

`check` の主なオプションは次のとおりです。

| オプション | 使う場面 |
|---|---|
| `--scope setup` | ほとんどのスキルの最初 |
| `--stage impl` | `/sdd-impl` の終わり（テストと未完了タスク） |
| `--stage close` | `/sdd-close` の終わり |
| `--allow-missing` | issue フォルダを既に消した Re-close |
| `--format json` | CI やスクリプトから結果を読むとき |

`sdd.config.json` の `testCommand` は `check --stage impl` のときだけ実行されます（未設定なら実行しません）。

`runtime` が `bun` で Bun が入っていれば `bun` でも実行できます。Bun が無い環境では `sdd.mjs` は `node` で実行してください。

## 同梱スキル

`/sdd-init`、`/sdd-req`、`/sdd-design`、`/sdd-task`、`/sdd-impl`、`/sdd-fix`、`/sdd-close`、`/sdd-quick`、`/sdd-reverse`、`/sdd-steering` です。`/sdd-brownfield` はありません。

## どの流れを選ぶか

`/sdd-init` で `proposal.md` を書いたら、ブランチを切り、Impact に合った流れに進みます。

```mermaid
flowchart TD
  init[/sdd-init proposal.md/] --> branch["git checkout -b name"]
  branch --> route{Impact}
  route -->|Capabilities Steering Decisions がすべて none| quickPath["/sdd-quick → /sdd-close"]
  route -->|Type が docs| revPath["/sdd-reverse → /sdd-close"]
  route -->|それ以外| fullPath["/sdd-req → design → task → impl → close"]
  quickPath --> noteQuick["Quick は task.md のみ。requirements と design は書かない"]
  revPath --> noteRev["Reverse は requirements の追加のみ"]
```

### 通常の機能追加

`/sdd-req` → `/sdd-design` → `/sdd-task` → `/sdd-impl` → `/sdd-close`。ドキュメントやコードがずれたら `/sdd-fix` してから続けます。

### 小さな変更（quick）

`/sdd-quick` で `task.md` だけを書き、`/sdd-close`。仕様・steering・ADR を変える必要がある場合はそこで止まります。

### 既存の振る舞いの記録（reverse）

proposal の `Type: docs` のあと `/sdd-reverse` → `/sdd-close`（design や task が無くても close できる場合あり）。

### 既存アプリに SDD を入れる

`init` → `/sdd-steering` → 変更ごとに `/sdd-init` → `/sdd-req` または `/sdd-reverse`。

### proposal を複数ベースに置く

ベース上で `/sdd-init` を繰り返し、フォルダ名にトラッカーキーを付け、ブランチごとに close します。

```mermaid
flowchart LR
  R[/sdd-req/] --> D[/sdd-design/]
  D --> T[/sdd-task/]
  T --> I[/sdd-impl/]
  I --> F{内容のずれ}
  F -->|ある| X[/sdd-fix/]
  X --> I
  F -->|ない| C[/sdd-close/]
```

手順の要点は次のとおりです。

1. `/sdd-init` で `proposal.md` をベースブランチに作成（ブランチはまだ作らない）。
2. `git checkout -b <name>`
3. 選んだ流れのスキルを順に実行し、各スキルの指示どおりコミットする。
4. `/sdd-close` でベースを取り込み、恒久ドキュメントへ反映し、`issues/<name>/` を削除し、PR 用のタイトルと本文を表示する（PR は開かない）。

## 人が決めるところ

| スキル | 作業内容 |
|---|---|
| `/sdd-init` | 最大 3 問（Why、What Changes、Out of Scope） |
| `/sdd-req`、`/sdd-design`、`/sdd-reverse`、`/sdd-fix` | 1 ラウンド最大 5 問（スコア付き選択肢） |
| `/sdd-steering` の Resync | 差分を 1 件ずつ承認・却下・保留 |
| `/sdd-impl` | `task.md` の手動確認タスクを実施（自動ではチェックしない） |
| `/sdd-close` | マージ競合の解消、capability コード変更の確認、PR 文面のコピー |

Quick は質問しません。`/sdd-task` も質問しません。

## 任意のウォークスルー

`npm test` では実行しません。

- `node scripts/laravel-fixture-walkthrough.mjs`
- [laravel-fp](https://github.com/paterapatera/laravel-fp) を clone したうえで `node scripts/laravel-fp-walkthrough.mjs`（`LARAVEL_FP` でパス指定）

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
