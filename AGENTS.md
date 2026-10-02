# AGENTS.md

このリポジトリで作業する AI エージェント向けの手引き。概要と使い方は [README.md](README.md) を参照。

## このリポジトリは何か

SDD のスキル（`.agents/skills/`）と、対象リポジトリにコピーされる道具（型定義、検証スクリプト、HTML の生成）の**開発元**である。

- ここは対象リポジトリではない。`docs/sdd/` も `docs/specs/` も無いので、`sdd-*` のスキルをこのリポジトリに対して実行しない。
- スキルの中に書かれた `docs/sdd/...` や `deno task <タスク名>` は、**対象リポジトリでの**パスとコマンドである。ここで実行するものではない。

## どこを直すか

| 直したいもの | 場所 |
|---|---|
| スキルの手順 | `.agents/skills/<スキル>/SKILL.md` |
| スキルが使うひな形・参考資料 | `.agents/skills/<スキル>/assets/`、`references/` |
| 全スキルで共通の手引き（要件・設計・タスクの書き方、質問のしかた、コミットの形式など） | `.agents/skills/sdd-init/assets/sdd/guides/`（対象リポジトリの `docs/sdd/guides/` になる） |
| 型定義 | `.agents/skills/sdd-init/assets/sdd/schema/` |
| 検証・品質ゲートなどの道具 | `.agents/skills/sdd-init/assets/sdd/scripts/`（共通の処理は `scripts/lib/`） |
| 人向けの HTML | `.agents/skills/sdd-init/assets/sdd/render/` |
| 道具のコピーと hook の設置 | `.agents/skills/sdd-init/scripts/install.ts` |
| 恒久ドキュメントのひな形 | `.agents/skills/sdd-init/assets/templates/` |
| 品質ツールの提案 | `.agents/skills/propose-quality-tools/`（更新の手順は `MAINTAIN.md`） |

## コマンド

```sh
deno task test    # すべてのテスト（1分ほどかかる）
deno fmt          # Markdown は対象外
deno lint
```

コミットの前に、この3つがすべて通ることを確かめる。

## 守ること

### 仕組みの考え方

- **手順書の文章を足すより、道具で確かめる。** 3回の試行で、文章だけの決まりは守られず、道具が機械的に確かめている部分だけが守られた。
  新しい決まりを足すときは、`verify`、`doctor`、`finish-report` などで検出できないかを先に考え、検出する場合はテストも足す。
- **人の関わりは、要件（受け入れ条件）の確認と受け入れテストだけにする。** 人のコードレビューを前提にした手順を足さない。
- **特定のツールに頼らない。** Cursor や Claude Code の hook などに頼らず、Git の hook と Deno の道具で動くようにする。
- **要件・受け入れ条件・変えてはいけない振る舞いは、AI の判断では変えない。** 設計・影響範囲・タスクは AI が直して進めてよい。スキルの手順もこの線引きに合わせる。

### スキル（SKILL.md）の書き方

- frontmatter に `disable-model-invocation: true` を書き、description の最後に「ユーザーが <スキル名> の実行を明示的に指示した場合にだけ使う。」と書く。
- 「確認ポイント」または「止まる条件」の節を置き、ユーザーの回答を待つ場合を**すべて**列挙する。それ以外では止まらずに進める、と明記する。
- 「スキルを呼び出したこと（`/<スキル名>`）は、確認ポイントへの回答ではない。」と書く（呼び出しを承認と解釈して確認を飛ばす動きがあったため）。
- 要件と設計の質問は1件ずつ聞かせる（回答によって次の質問が変わるため）。
- 試行で崩れた点への対策は、「守ること（試行で崩れた点）」のように、理由と一緒に書く。
- 日本語の常体で書く。用語は既存のものに揃える（恒久ドキュメント、受け入れ条件、変えてはいけない振る舞い、品質ゲート、基盤issue、道具、確認ポイント）。
  `propose-quality-tools` だけは英語で書いている（提案の出力テンプレートは日本語）。既存の書き方に合わせる。

### 道具（`assets/sdd/`）のコード

- 対象リポジトリで、`docs/sdd/deno.json`（import map なし、lock なし、`node_modules` なし）のもとで動く。外部のパッケージは使わず、`node:` の組み込みモジュールと Deno の API だけを使う。
- 対象リポジトリの言語は問わない。対象リポジトリに Node.js などがある前提で書かない。
- 新しいタスクを足したら、`assets/sdd/deno.json` の `tasks` に、必要な最小限の権限で登録する。

### 型定義（`schema/`）

- 型で守るのは、ID、参照、必須項目、列挙値だけにする。文章は `string` のままにする。
- `as const satisfies Record<string, T>` で ID のリテラル型を保ち、追跡用の対応関係は `Record<ReqId, …>` で書いて、対応漏れを型エラーにする。
- spec のファイルにはデータだけを書かせる（関数やロジックは書かせない）。図もデータで持ち、HTML の生成時に SVG にする。
- 型定義を変えたら、次をすべて行う。
  1. 版を上げる: `schema/version.ts` の `SCHEMA_VERSION`、`assets/sdd/config.ts` の `schemaVersion`、`tests/install_test.ts` の期待値
  2. ひな形（各スキルの `assets/*-template.ts`、`assets/templates/`）と、テストのサンプル（`tests/fixtures/specs/`）を新しい型に合わせる
  3. 型が誤りを検出することを `tests/types_test.ts` で確かめる（`@ts-expect-error` を使う）

### 人向けの HTML（`render/`）

- 1ファイルで完結させる（CSS と JavaScript は埋め込み、CDN は使わない）。
- 色は `render/html.ts` のパレットだけを使い、テーマはライトだけにする。パレットに赤が無いのでエラーは plum で表し、色だけに頼らず必ずアイコンか文字のラベルを添える。
- ID はすべてはっきり表示し、コピーできるようにする。

### テスト

- `tests/helpers.ts` の `makeProject`（`docs/sdd` と spec を置いた一時ディレクトリ）、`emptyRepo`・`install`（Git リポジトリへの導入）を使う。
- サンプルの spec は `tests/fixtures/specs/` にある。`EX-001` が完全モード、`EX-002` が軽量モード。
- 道具の検出を足したら、検出する場合と検出しない場合の両方をテストする。

## コミット

- 1行目は日本語で、何をなぜ変えたかを書く。1つのスキルだけの変更なら `sdd-init: ...` のようにスキル名を先頭に付ける。
- 型定義の版を上げたら、1行目の最後に `（型定義 0.9.0）` のように版を書く。
- 変更が複数あるときは、本文に箇条書きで書く。
- 対象リポジトリ向けの Conventional Commits の形式（`guides/commits.md`）は、このリポジトリのコミットには使わない。
