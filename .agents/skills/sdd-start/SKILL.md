---
name: sdd-start
description: SDD（仕様駆動開発）でissueの作業を始める。issueの内容を受け取って docs/specs/<issue>/issue.md に取り込み、規模を判定して完全モードか軽量モードかを決め、作業ブランチを作り、他のブランチとの衝突を確認する。ユーザーが sdd-start の実行を明示的に指示した場合にだけ使う。
disable-model-invocation: true
---

# sdd-start

issueの作業を始める。取り込み → 規模の判定 → ブランチの作成 → `issue.md` の作成 → 衝突の確認、の順に進める。

このスキルのファイル:

- `assets/issue-template.md`: `issue.md` のひな形
- `references/issue-format.md`: `issue.md` の書き方
- `references/sizing.md`: 規模の判定基準（完全モードか軽量モードか）

`docs/sdd/deno.json` のタスクは、リポジトリのルートで `deno task --config docs/sdd/deno.json <タスク名>` として実行する。
以下では `deno task <タスク名>` と略す。

## 確認ポイント

ユーザーの回答を待つのは、次の場合だけ。質問を示して返答を終え、回答を受け取ってから先に進む。

1. **前提の問題**（手順1）: pre-commit hook の設置、未コミットの変更の扱い。
2. **issue とブランチの確認**（手順4の後）: 次をまとめて1回で聞く。
   - issue の内容が足りない場合の不足分（ID、URL、添付）、数字だけのIDの接頭辞、正規化で変わったID
   - 規模の判定の結果と、完全モードか軽量モードか
   - ブランチ名の案（`slug`）
   - architecture.ts に反映されていない構成の変更があった場合（手順3）、その扱い

質問ツール（Cursor の AskQuestion など）があれば使う。確認ポイント2の項目は互いに依存しないので、1回の呼び出しにまとめてよい。
スキルを呼び出したこと（`/sdd-start`）は、確認ポイントへの回答ではない。
確認の後は止まらずに最後まで進め、行ったことを最後に報告する。

## 1. 前提を確認する

1. `docs/sdd/config.ts` が無ければ、先に sdd-init を実行するよう案内して止まる。
2. `deno task doctor` を実行する。
   - pre-commit hook が無い場合: 次を実行してよいかをユーザーに確認し、了承を得て実行する。
     ```sh
     deno run --allow-read --allow-write --allow-run=git .agents/skills/sdd-init/scripts/install.ts --hook-only
     ```
   - 型定義の版が違う場合: sdd-init で更新するよう案内して止まる。
   - Deno が無い場合: インストール方法（https://docs.deno.com/runtime/getting_started/installation/ ）を案内して止まる。
3. `git status --porcelain` で未コミットの変更が無いことを確認する。あれば、どうするかをユーザーに確認する。

## 2. issueの内容を受け取る

最初の指示に含まれているものを使う。足りないものは確認ポイント2でまとめて聞く。

- `docs/sdd/config.ts` に `forge` があり、issue の番号が分かる場合は、`docs/sdd/guides/forge.md` に従ってCLIで本文とコメントを取得する。
- 本文がまったく無く、CLIでも取得できない場合は、規模の判定ができないので、先に本文だけを求める。

| 項目 | 必須 | 受け取り方 |
|---|---|---|
| issueのID | 必須 | 例: `PROJ-123`、`RM-4567` |
| issueのURL | 任意 | 無ければ「未記載」 |
| 本文とコメント | 必須 | チャットに貼り付けるか、テキストファイルのパスで渡す |
| 添付ファイル | 任意 | ファイルのパスで渡す（チャットに直接貼った画像はファイルとして保存できないため） |

### IDの正規化

IDはディレクトリ名とブランチ名に使う。

- 使える文字は英数字とハイフンだけ（`[A-Za-z0-9-]`）。それ以外の文字はハイフンに置き換え、連続するハイフンは1つにまとめる。
- 数字だけのID（`123`、`#123`）は、`docs/sdd/config.ts` の `issueIdPrefix` があれば、それを付ける（例: `FJ` なら `FJ-123`）。
  無ければ、接頭辞（例: `GH`、`GL`、`RM`）を**ユーザーに聞き**、今後のために `issueIdPrefix` に登録してよいかもあわせて聞く。推測しない。
- 正規化でIDが変わった場合は、変換後のIDをユーザーに確認する。

### 作業中でないかの確認

次のどちらかに当てはまれば、そのissueはすでに作業中である。その旨を伝えて sdd-status を案内し、止まる。

- `docs/specs/<ID>/` がある（大文字小文字を区別せずに探す）
- `git branch -a | grep -i -- "<ID>-"` にブランチがある

## 3. 構成が古くなっていないかを確認する

`deno task drift` を実行する。構成に関わる変更が報告された場合は、architecture.ts と照らし合わせる。

- **すでに反映済み**の場合（前のissueの sdd-finish で反映した変更など）: **質問せずに** `basedOn` を比較先のコミット
  （`git rev-parse origin/<既定ブランチ>`）に進め、`updatedAt` を今日の日付にする。sdd-finish では squash マージでハッシュが
  変わるため `basedOn` を更新しないので、ここで進める。この変更は issue.md と一緒にコミットしてよい。
- **反映されていない**場合: 確認ポイント2で伝え、architecture.ts の更新をこのissueの sdd-finish でまとめて行うか、
  別のPRで行うかを決めてもらう。sdd-finish で行う場合も `basedOn` は変えない（内容だけを直し、`basedOn` は次の sdd-start で進める）。

## 4. 規模を判定する

`references/sizing.md` を読み、その手順で判定する。
判定の結果と理由を、確認ポイント2で示す。**完全モードか軽量モードかはユーザーに決めてもらう。**

判定のためにコードを調べたときに見つけた「触りそうなファイルやディレクトリ」は、手順7で使うので控えておく。

## 5. 作業ブランチを作る

1. ブランチ名は `<branchPrefix><IDを小文字にしたもの>-<slug>` にし、**すべて小文字**にする（例: ID が `GH-2` なら `feature/gh-2-print-date`）。
   大文字を含むと、リモートでは小文字、ローカルでは大文字のブランチが別々に存在する状態になりやすいため。
   - `branchPrefix` は `docs/sdd/config.ts` の値（既定は `feature/`）。
   - `slug` はissueの内容を表す英小文字・数字・ハイフンの短い語（2〜5語）。確認ポイント2で案を示す。
   - specのディレクトリ名（`docs/specs/<ID>`）は、IDの表記のまま（大文字を含んでよい）。
     他のスキルは `deno task current` でブランチ名からIDを特定する（大文字小文字を区別しない）。
2. リモートがあれば最新の既定ブランチから作る。
   ```sh
   git fetch origin
   git switch -c <ブランチ名> origin/<既定ブランチ>
   ```
   リモートが無ければ、手元の既定ブランチから作る。

## 6. issue.md を作る

`references/issue-format.md` を読み、`assets/issue-template.md` をもとに `docs/specs/<ID>/issue.md` を作る。
添付ファイルは `docs/specs/<ID>/attachments/` にコピーする。

- 受け取った内容に無いことを書き足さない。整理はしても、解釈や補完はしない。
- 受け入れ条件が書かれていなければ「未記載」と書く（要件を作るときに質問する）。
- 手順4で決めたモードを記録する。

## 7. 他のブランチとの衝突を確認する

手順4で控えた「触りそうなファイルやディレクトリ」を渡して実行する。

```sh
deno task conflicts --paths <ファイルやディレクトリをカンマ区切りで>
```

- `[重なり]` があれば、どのブランチの誰の作業と重なりそうかをユーザーに伝え、担当者との調整を勧める。
- この時点の影響範囲は推定なので、作業は止めない。設計を作った後（sdd-design）に、もう一度確かめる。

## 8. コミットして次の工程を案内する

1. `docs/specs/<ID>/` をコミットする。コミットメッセージは `docs(<ID>): issueを取り込み`（形式は `docs/sdd/guides/commits.md`）。
   push は、最初のspecを作ったとき（sdd-req または sdd-quick）に行う。
2. 次の工程を案内する。
   - 完全モード → sdd-req（要件を作る）
   - 軽量モード → sdd-quick（specを1ファイルで作る）
