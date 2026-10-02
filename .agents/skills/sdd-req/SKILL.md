---
name: sdd-req
description: SDD（仕様駆動開発）の完全モードで、issue.md から要件（機能要件、非機能要件、変えてはいけない振る舞い）を作り、docs/specs/<issue>/requirements.ts に書く。受け入れ条件は人の受け入れテストの基準になるので、HTMLで人に確認してもらう。ユーザーが sdd-req の実行を明示的に指示した場合にだけ使う。
disable-model-invocation: true
---

# sdd-req

完全モードの要件（`docs/specs/<ID>/requirements.ts`）を作る。

人はコードレビューを行わず、受け入れテストだけを行う。受け入れテストの基準は、ここで作る受け入れ条件である。
そのため、完全モードで人が内容を確認するのは**この要件だけ**で、設計とタスクはAIに任せる
（設計で、要件などから判断できない選択があれば、sdd-design がそこだけ質問する）。

このスキルのファイル:

- `assets/requirements-template.ts`: `requirements.ts` のひな形

対象リポジトリの手引き（書く前に必ず読む）:

- `docs/sdd/guides/writing-requirements.md`: 要件の書き方（EARS、Given/When/Then、非機能要件、変えてはいけない振る舞い）
- `docs/sdd/guides/asking-questions.md`: 質問のしかた（1件ずつ聞く）
- `docs/sdd/guides/review-feedback.md`: 指摘を受けたときの手順

`docs/sdd/deno.json` のタスクは、リポジトリのルートで `deno task --config docs/sdd/deno.json <タスク名>` として実行する。
以下では `deno task <タスク名>` と略す。

## 確認ポイント

ユーザーの回答を待つのは、次の2つだけ。どちらも質問を示して返答を終え、回答を受け取るまで先に進まない。

1. **未確定の点の質問**（手順5）: `docs/sdd/guides/asking-questions.md` に従い、**1件ずつ**聞く。
   回答によって次に聞くべきことが変わるため、まとめて聞かない。質問ツールがあれば使い、1回の呼び出しに1問だけ入れる。
   **利用者から見える振る舞いで issue に明記されていないものは、既存のコードに既定の動きがあっても質問する**（推測で決めない）。
2. **要件全体の確認**（手順6）: 未確定の点がすべて解消した後に、HTMLで要件全体を確認してもらう。
   指摘を反映した結果、受け入れ条件が指摘の範囲を超えて変わった場合だけ、もう一度確認してもらう。

スキルを呼び出したこと（`/sdd-req`）は、確認ポイントへの回答ではない。

## 1. 前提を確認する

1. `deno task current` で issue の ID とモードを特定する。
2. `docs/specs/<ID>/issue.md` の「モード」が完全モードであることを確かめる。
   - issue.md が無い → sdd-start を案内して止まる。
   - 軽量モードになっている → sdd-quick を案内して止まる。
3. `requirements.ts` がすでにあれば、作り直すのではなく、手直しとして扱う。
4. `spec.ts` がある場合は、軽量モードから切り替えてきたものである。要件を作るときの入力として使い、
   `requirements.ts` をコミットするときに `git rm` で削除する（両方あると混在になるため）。

## 2. 調べる

1. `issue.md`、`attachments/`、（あれば）`spec.ts` を読む。
2. `docs/sdd/architecture.ts`、`conventions.ts`、`nfr.ts`（プロジェクト全体の非機能要件）、`adr/` を読む。
3. コードを調べる。ここでは設計はせず、要件を決めるのに必要なことだけを調べる。
   - 既存の振る舞いのうち、変えてはいけないもの（呼び出し元、公開API、保存データの形式）
   - issue に出てくる用語が、コード上で何に当たるか
   - 既存の制約（入力の上限、権限、対応環境など）

## 3. 要件を書く

`assets/requirements-template.ts` をもとに `docs/specs/<ID>/requirements.ts` を書く。手引きに従う。

- 機能要件は、EARSで規則を書き、受け入れ条件（Given/When/Then）で具体例を書く。境界値と異常系も具体例にする。
- 非機能要件は、`nfr.ts` との差分だけを書く。
- 変えてはいけない振る舞いは、手順2で調べたものを書く。
- issue とコードから決められないことは推測で埋めず、`openQuestions` に書く。選択肢と推奨も考えておく。
  利用者から見える振る舞い（文言、並び順、遷移先、既存の画面の扱い、不正な入力への対応）で issue に明記されていないものは、
  既存のコードに既定の動きがあっても `openQuestions` に書く。
- 受け入れ条件には確かめ方（`verifiedBy`）を付ける。人が確かめるもの（human）は、画面で分かる形で `then` を書く。
  HTTPステータスやログなど人に確かめにくいものは automated にする。
- issue のコメントで対象外とされたものは `outOfScope` に書く。
- 受け入れ条件には種類（正常系・境界値・異常系）を付け、境界値・異常系が無い場合は理由を書く。
- 非機能要件の検討結果（`nfrReview`）、issue の受け入れ条件との対応（`issueCoverage`）を書く。

書いたら、次を実行し、エラーが無くなるまで直す。

```sh
deno task check <ID>
deno task verify <ID>
```

## 4. HTMLを生成する

```sh
deno task render <ID>
```

## 5. 確認ポイント1: 未確定の点を1件ずつ質問する

質問の前に、`docs/sdd/guides/writing-requirements.md` の「十分性のチェックリスト」で要件を点検し、`checklist` を書く。
点検で見つかった不足は受け入れ条件に追加し、決められないことは `openQuestions` に加える。
あわせて `assumptions`（前提）を見直し、**利用者から見える振る舞いに関わる前提は `openQuestions` に移す**（確認の前に質問する）。

`openQuestions` が空でなければ、`docs/sdd/guides/asking-questions.md` の手順で、**1件ずつ**質問する。

1. 他の質問に最も影響するものを1件選び、選択肢と推奨を添えて聞く。返答を終えて回答を待つ。
2. 回答を requirements.ts に反映し、`openQuestions` から消す。残りの未確定の点を見直す
   （回答で決まったものは消し、前提が変わったものは聞き方を変え、新しく必要になったものは加える）。
3. `deno task check <ID>` と `deno task verify <ID>` を通す。
4. `openQuestions` が空になるまで1〜3を繰り返す。

## 6. 確認ポイント2: 要件全体を確認してもらう

確認を頼む前に、`deno task verify <ID>` の**警告をすべて直す**（直さない警告は、理由を確認の中で示す）。
`deno task render <ID>` でHTMLを生成し直し、次を**1つの返答にまとめて**示して回答を待つ（HTMLのパスだけを示さない）。

- 生成したHTMLのパス（`.sdd/out/<ID>/index.html`）。「受け入れテスト」の章が、受け入れテストで確かめる項目になることを伝える
- 要件の要約: 機能要件ごとのEARSの文章、受け入れ条件の件数（正常系・境界値・異常系の内訳と、人が確かめるものの件数）、非機能要件、変えてはいけない振る舞い、前提、対象外
- 十分性のチェックリストの結果（HTMLの「十分性の確認」）。特に `notApplicable` にした観点と、その理由
- 質問への回答で決まったこと

指摘は `docs/sdd/guides/review-feedback.md` の手順で反映する。指摘への対応で新たに未確定の点が出たら、手順5に戻って1件ずつ聞く。

## 7. コミットして push する

1. `deno task check <ID>`、`deno task verify <ID>`、`deno task render <ID>` を実行する（`openQuestions` は空であること）。
2. `docs/specs/<ID>/` をコミットする（`spec.ts` から切り替えた場合は、その削除も含める）。コミットメッセージは `docs(<ID>): 要件を作成`。
3. `git push -u origin <ブランチ名>` で push する（他の人の衝突チェックに見えるようにするため）。リモートが無ければ省く。

## 8. 報告する

確定した要件の要点と、HTMLのパスを報告し、次の工程として sdd-design を案内する。
PR/MR はこの時点では作らない（sdd-finish で作る）ことも伝える。
この後、sdd-design は要件などから判断できない設計上の選択がある場合だけ質問し、sdd-tasks と sdd-impl は止まらずに進む。
次に人が関わるのは、設計上の質問（あれば）と受け入れテストであることも伝える。
