# Bun 移行計画

対象リポジトリへコピーする道具の実行環境を、Deno から Bun 1.4.3 以降へ替える。

## 方針

道具が正しく動くために必要なものだけを書く。Deno の権限フラグと同じ柵は、スクリプトで作り直さない。

正しさとして残すのは、次の三つである。

- verify、render、gate などが、今と同じファイルを読み、同じ場所へ書き、git を起動し、同じ終了コードを返す。
- spec と schema の型検査が、対象リポジトリの `package.json` と `tsconfig.json` に引きずられない。
- 対象リポジトリに Node.js も `node_modules` も増えない。必須なのは Bun 1.4.3 以降の単体バイナリだけである。

## 実行の形

`deno task --config docs/sdd/deno.json <タスク>` は使わない。Bun は `deno.json` の tasks を読まない。対象へ `package.json` の scripts も足さない。

タスクはファイルを直接実行する。

```sh
bun docs/sdd/scripts/verify.ts
bun docs/sdd/scripts/check.ts
bun docs/sdd/render/main.ts
```

引数は `process.argv` で受ける。子プロセスの起動に使う Bun のパスは `process.execPath` にする。`check.ts` と `finish-report.ts` が今 `Deno.execPath()` で Deno を起動している箇所は、このパスへ替える。

## 書かないもの

- `--allow-read`、`--allow-write=../../.sdd`、`--allow-run=git` に相当する拒否。verify と render の出力先は、今どおり `.sdd` のままスクリプトが書く。
- 対象リポジトリの `package.json` と `tsconfig.json` の書き換え。
- spec と schema 以外を、対象リポジトリ上の型検査に含めること。道具のスクリプトを含めると `node:` の型のために `node_modules` が要る。
- `deno fmt` の `lineWidth: 120` と同じ出力にすること。対象のフォーマットは、今どおり品質ゲートが対象のコマンドを起動する。

## 書くもの

### スクリプト

`Deno` 名前空間を外す。

| 今 | 移行後 |
|---|---|
| `Deno.readTextFile`、`Deno.writeTextFile`、`Deno.readDir`、`Deno.mkdir`、`Deno.remove`、`Deno.stat`、`Deno.makeTempDir`、`Deno.writeFile` | `node:fs/promises` |
| `Deno.Command` | `node:child_process` の `spawn`（git の標準出力を読む） |
| `Deno.args` | `process.argv` |
| `Deno.exit` | `process.exit` |
| `Deno.cwd` | `process.cwd` |
| `Deno.errors.NotFound` | エラーコード `ENOENT` |
| `Deno.version.deno` | `Bun.version` |

主な箇所は `assets/sdd/scripts/`、`assets/sdd/render/main.ts`、`assets/sdd/scripts/lib/`、`sdd-init/scripts/install.ts` である。

### 型検査

`docs/sdd` に、spec と schema だけを含む `tsconfig.json` を置く。`extends` は付けない。`compilerOptions.types` は空にする。`allowImportingTsExtensions` を付ける。削除されたオプションは置かない。

検査コマンドは `bun check` にしない。対象に `check` スクリプトがあると、`bun check` は型検査ではなくそのスクリプトを起動する。ファイル渡しは、近い `tsconfig.json` を使う。

使うのは次である。

```sh
bun --check --tsconfig-override docs/sdd/tsconfig.json
```

`check.ts` は、このコマンドを `process.execPath` で起動する。検査対象は schema と、引数で指定された spec（省略時は `docs/specs` のすべて）に限る。

### 版の確認

`doctor.ts` と `install.ts` は、Bun 1.4.3 以上かを見る。Deno 2 以上は見ない。1.4.3 は、`bun check` と `--tsconfig-override` がある下限である。

### 呼び出し元

スキル（`SKILL.md`）、ガイド、hook、`install.ts`、テスト、`eval/scenarios/` の `deno task --config docs/sdd/deno.json` を、上の直接実行へ替える。pre-commit が止める条件は、今と同じく、実行環境が無いか、型検査か検証が落ちたときである。

## 完了条件

次が通ってから、対象リポジトリの必須環境を Bun にする。

- ルートに `package.json`（`check` スクリプト付き）と `tsconfig.json` がある対象で、spec と schema の型検査が、今の `deno check --config docs/sdd/deno.json` と同じ結果になる。対象の `check` スクリプトは起動しない。
- その状態で `node_modules` は増えない。
- verify、render、gate、doctor、hook が、今と同じ入出力と終了コードで通る。
- このリポジトリの `deno task test` が、道具を Bun 1.4.3 以降で起動して通る。

## 参照

- [Bun v1.4.3](https://bun.com/blog/bun-v1.4.3) — `bun check` が入った版。
- [Type checking](https://bun.com/docs/runtime/check) — `check` スクリプトがあると `bun check` はそれを起動する。型検査へ戻すのは `bun --check` で、`--tsconfig-override` を付けるとその `tsconfig.json` を使う。
