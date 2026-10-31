# sdd-orc

[English](README.md)

Cursor、Codex、Claude Code 向けの [仕様駆動開発（SDD）](https://github.com/paterapatera/sdd-orc) スキルと、共通の検査スクリプトをインストールします。

パッケージ名は `@paterapatera/sdd-orc` 0.3.18 です。恒久ドキュメントは、指定したディレクトリ（既定は `docs`）の下でフォーマット版 1 を使います。Node.js 18 以降が必要です。

issue の登録、プルリクエストの作成、`Closes #1` の記述は別のトラッカー連携スキルの範囲です。このパッケージはトラッカーと通信しません。

## インストール

リポジトリのルートで:

```sh
npx @paterapatera/sdd-orc init
```

`init` は対話しません。既定値は次のとおりです。

| オプション | 既定値 |
|---|---|
| `--docs-dir` | `docs` |
| `--lang` | `en`（`en` または `ja`） |
| `--runtime` | `node`（`node` または `bun`） |
| `--base-branch` | `main` |
| `--skills-dir` | `.agents`（エージェントごとにフラグを繰り返す） |

2 つのエージェント向けの例:

```sh
npx @paterapatera/sdd-orc init --lang ja --runtime bun --skills-dir .agents --skills-dir .claude
```

`sdd.config.json` を書き、同じスキルをすべての `<skills-dir>/skills/` にコピーし、スクリプトは最初の skills ディレクトリだけに置きます。

```text
.agents/skills/sdd-scripts/sdd.mjs
```

すべてのスキルはこのパスを呼び出します。CI がネットワークなしでスクリプトを実行できるよう、`<skills-dir>` をコミットしてください。

`init` はドキュメントの骨組み（`index.md`、`specs/index.md`、`specs/log.md`、`decision/index.md`）を作ります。`steering/` は作りません。`/sdd-steering` で作成します。ドキュメントディレクトリに、このレイアウトで管理しない Markdown が既にある場合は `init` が停止し、専用の `--docs-dir` を指定するよう案内します。

インストール後に異なる設定を渡すとエラーで終了します。`--force` で上書きできます。

## 更新と移行

```sh
npx @paterapatera/sdd-orc update
npx @paterapatera/sdd-orc migrate
```

`update` は `sdd.config.json` に従ってスキルと共通スクリプトを更新し、`version` を上げます。恒久ドキュメントは変更しません。パッケージのフォーマットが `formatVersion` より新しい場合は `migrate` の実行を促し、ファイルは書き込みません。パッケージから消えた skill は各 skills ディレクトリから削除し、`UPDATE_REMOVED_SKILL` を stderr に出します。

`migrate` は将来フォーマットが変わったときに恒久ドキュメントを機械的に変換します。`check` が失敗した場合は何も書き込みません。フォーマット版 1 では変換対象はありません。

## 同梱スクリプト

選んだランタイムで、インストール済みのスクリプトを実行します。既定の例:

```sh
node .agents/skills/sdd-scripts/sdd.mjs check
node .agents/skills/sdd-scripts/sdd.mjs stamp --issue <name>
node .agents/skills/sdd-scripts/sdd.mjs apply --issue <name>
node .agents/skills/sdd-scripts/sdd.mjs renumber [--base main] [--code OLD=NEW]
node .agents/skills/sdd-scripts/sdd.mjs index
node .agents/skills/sdd-scripts/sdd.mjs status [--issue <name>] [--all]
```

`check` は恒久ドキュメント全体と、現在のブランチに対応する issue を検査します。`--issue` で issue を指定できます。`--scope setup` は設定、骨組み、steering の必須 5 ファイルだけを確認します。`--stage close` は close 時の追加ルールを有効にします。`--stage impl` は実装を機械検証します（`sdd.config.json` の任意項目 `testCommand`、git 未追跡を含む自動テストファイル内の要件 ID 参照、未完了の実装タスク。Manual verification は note のみ）。`--allow-missing` または `--if-issue` は issue ディレクトリが無いとき成功します（hotfix や Re-close 向け）。`--format json` は check で `{ "ok", "diagnostics", "notes" }` を出力します。steering 等の変更で `index.md` が古い場合、`check` は他のルールの前に index を再生成します。

`sdd.config.json` の任意項目 `testCommand` は `check --stage impl` のときだけ実行されます（未設定ならスキップ）。

`status` は現在ブランチ、指定 `--issue`、または `--all` の全 issue について、フェーズと次に使う skill を表示します。

終了コードは `0`（問題なし）、`1`（ルール違反）、`2`（使い方またはセットアップ）です。行の形式は `path:line: RULE message` です。

`stamp` は、`base` のない置換・削除に、現在の恒久ドキュメント本文から求めた base ハッシュを書き込みます。`apply` は issue の差分を恒久ドキュメントに反映し、新しい ID を採番します。結果が `check` に通らない場合は何も書き込みません。`index` はすべての `index.md` を `description` から再生成します。`renumber` は、このブランチで追加した ID のうち、ベースブランチに既に存在するものだけを空き番号に振り直します。新しい capability のコードがベースブランチと重複する場合は、`--code OLD=NEW` を渡すまで `renumber` は停止します。

## 利用の流れ

スキル本文は英語です。各スキルは最初に `check --scope setup` を実行します。ブランチ名は `issues/<name>/` と一致させます。

通常の変更:

1. `/sdd-init` で `issues/<name>/proposal.md` を作成する。
2. `git checkout -b <name>`
3. `/sdd-req` で `requirements.md` を作成する。
4. `/sdd-design` で `research.md` と `design.md` を作成する。
5. `/sdd-task` で `task.md` を作成する。
6. `/sdd-impl` で未完了の大項目を実装する。ずれがあれば `/sdd-fix` で直す。
7. `/sdd-close` でベースブランチを取り込み、`apply` と `check --stage close` を実行し、issue ディレクトリを削除し、プルリクエストのタイトルと本文を出力する。

小さな変更: `/sdd-init` → `/sdd-quick` → `/sdd-close`。Quick は質問せず、requirements、research、design は書きません。specs、steering、決定の変更が必要な場合は停止します。

既存の振る舞いの書き起こし: `Type: docs` の `/sdd-init` → `/sdd-reverse` → `/sdd-close`。Reverse は requirements の追加だけを行います。

稼働中のアプリへ SDD を導入するとき: `init` と `/sdd-steering` のあと `/sdd-brownfield` で spec とコードのギャップを洗い出してから issue を切ります。

複数の提案をまとめて起票する（よくある開始方法）:

1. ベースブランチ上で、変更ごとに `/sdd-init` を実行する。
2. トラッカーに issue を登録する（別のトラッカー連携スキルでも可）。各ディレクトリ名の先頭にトラッカーのキーを付ける。
3. ベースブランチに `proposal.md` をコミットする。
4. `git checkout -b <key>-<name>` で着手し、`/sdd-req` または `/sdd-quick` から進める。
5. `/sdd-close` でブランチ上の issue ディレクトリを削除する。マージ後はベースブランチからも消える。

## 手動検証スクリプト

`scripts/` には、自動テスト（`node --test`）の対象外の任意スクリプトがあります。

- `node scripts/laravel-fixture-walkthrough.mjs` — Laravel 風の一時リポジトリで init から close まで通す。
- [laravel-fp](https://github.com/paterapatera/laravel-fp) を clone したうえで `node scripts/laravel-fp-walkthrough.mjs`（`LARAVEL_FP` でパス指定可）。

## プルリクエスト

プルリクエストの CI で `check` を実行し、そのチェックを必須にすることを推奨します。マージ前にベースブランチへ追従させるブランチ保護も推奨します。これらはリポジトリ設定の推奨であり、このパッケージが必須とするものではありません。

次のジョブは共通スクリプトだけを実行します。トラッカーや、ワークフロー実行環境以外の CI 製品は呼びません。

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

`sdd.config.json` の `"runtime"` が `"bun"` で **Bun が入っている** ときは `node` の代わりに `bun` を使います。同梱の `sdd.mjs` は Node 用スクリプト（`#!/usr/bin/env node`）なので、Bun が無い環境では **Node のまま実行**できます（例: `node .agents/skills/sdd-scripts/sdd.mjs check`）。**Node 18 以降**を想定します（下の CI 例は 24）。スキル本文が `bun` と書いていても、手元で Bun が無ければコマンドだけ `node` に読み替えてください。スクリプトが別の skills ディレクトリにある場合は、そのパスに読み替えてください。
