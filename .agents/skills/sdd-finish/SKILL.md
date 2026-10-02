---
name: sdd-finish
description: SDD（仕様駆動開発）でissueの作業を完了する。受け入れテストの合格後に、長く残す知識を恒久ドキュメント（ADR、architecture など）へ反映し、docs/specs/<issue> を削除して、spec の要約を本文に書いた PR/MR を作る。ユーザーが sdd-finish の実行を明示的に指示した場合にだけ使う。
disable-model-invocation: true
---

# sdd-finish

specは squash マージの前に削除するので、main の履歴には残らない。代わりに次で残す。

1. 恒久ドキュメント（`docs/sdd/`）への反映（必須）
2. **PR/MR の本文に、spec の要約**（要件、受け入れ条件、主な設計判断）を書く
3. squash マージのコミットメッセージに、issue の ID と PR/MR の URL を入れる

HTML や zip を issue や PR/MR に添付することは**しない**。

このスキルのファイル:

- `assets/pr-body.md`: PR/MR の本文のひな形（spec の要約）
- `assets/squash-message.md`: squash マージのコミットメッセージのひな形
- `assets/issue-comment.md`: issue に投稿するコメントのひな形

対象リポジトリの手引き:

- `docs/sdd/guides/forge.md`: ホスティングのCLI（PR/MR の作成、squash マージ、issue へのコメント）の使い方
- `docs/sdd/guides/review-feedback.md`: PR/MR を作った後に変更が入った場合

`docs/sdd/deno.json` のタスクは、リポジトリのルートで `deno task --config docs/sdd/deno.json <タスク名>` として実行する。
以下では `deno task <タスク名>` と略す。

## 確認ポイント

ユーザーの回答を待つのは、**開始時の1回だけ**。次をまとめて聞き、回答を受け取るまで先に進まない
（質問ツールがあれば使い、これらは1回にまとめてよい）。**「受け入れOK」だけでは、2と3への回答にならない。**

1. 受け入れテストに合格したか（HTMLの「受け入れテスト」の章の項目をすべて確かめたか）
2. PR/MR を作成してよいか（`docs/sdd/config.ts` の `forge` が無ければ、本文の案を渡すと伝える）
3. 作業ツリーに未コミットの変更がある場合: それを含めてよいか（受け入れテスト中の修正などは、内容を示して確認する）

スキルを呼び出したこと（`/sdd-finish`）は、確認ポイントへの回答ではない。
ただし、ユーザーの指示に回答が明記されていれば（例:「受け入れテストは合格。PRも作って」）、それを回答として扱う。
受け入れテストが不合格・未実施なら止まり、不合格の内容をチャットで伝えてもらう（sdd-impl で直す）。

確認の後は止まらずに最後まで進め、行ったことを最後に報告する。

## 1. 前提を確かめる

1. `deno task current` で issue の ID を特定する。
2. 確認ポイントの質問をして、回答を受け取る。
3. 未コミットの変更を含めてよいと回答された場合は、`deno task gate` を通してから、内容に合ったメッセージでコミットする
   （受け入れテストでの指摘の反映なら `fix(<ID>): 指摘を反映`。恒久ドキュメントの変更と混ぜない）。
4. 材料を洗い出す（finish-report は品質ゲート `gate --full` も実行する）:
   ```sh
   deno task finish-report <ID>
   ```
   「完了の条件」にエラーがあれば直す。よくあるもの:
   - 完了したタスクにコミットが無い、空のコミットがある → 1タスク＝1コミットになっていない。タスクを統合するなど、spec を実態に合わせる
   - 影響範囲の外の変更がある → spec の impact を直す
   - 未確定の点（openQuestions）が残っている → 受け入れテストに合格しているなら、解消済みの内容で要件を直す。判断できなければユーザーに聞く
   - 依存関係の定義が変わったのに ADR にする設計判断が無い → ユーザーに質問し、design.ts の decisions に理由と代替案を書く
   - 品質ゲートを緩めた変更がある → 元に戻す。必要ならユーザーに質問し、decisions の `relaxesQualityGate` に書く
   - 採用済みの ADR を書き換えている → 元に戻し、覆すなら新しい ADR を作る
5. `finish-report` の「手で守る規約」に出た守り方どおりに実装されているかを、コードで確かめる。守られていなければ直し、
   品質ゲートを通してコミットする（`fix(<ID>): 規約に合わせて修正`）。「品質ゲートでテストを除外している設定」の警告は報告に含める。

## 2. 恒久ドキュメントへ反映する

`finish-report` の結果をもとに、AIが判断して反映する（了承は求めない。反映した内容は最後に報告する）。

| 対象 | 反映する内容 |
|---|---|
| `docs/sdd/adr/ADR-xxxx.ts` | design.ts の decisions のうち `adr: true` のもの。`issue` にこの issue の ID を書く。ひな形は `.agents/skills/sdd-init/assets/templates/adr/ADR-0001.ts` |
| `docs/sdd/architecture.ts` | 新しいモジュール、モジュールの責務の変化、技術スタックの追加、削除したもの。`updatedAt` を今日の日付にする |
| `docs/sdd/conventions.ts` | このissueで新しく決め、今後も守る規約（ADRと対になることが多い）。1つのissueで一度使っただけのやり方は規約にしない |
| `docs/sdd/nfr.ts` | 非機能要件のうち、プロジェクト全体の基準にすべきもの。判断がつかなければ反映せず、報告で提案する |
| `docs/sdd/config.ts` | 品質ゲートのツールを導入・変更した場合は `commands` |

- **architecture.ts の `basedOn` は変更しない。** squash マージでブランチのコミットのハッシュが変わるため。
  次の sdd-start の drift の確認で、反映済みであることを確かめてから main のコミットに進める。
- 軽量モードでは、反映するものが無いことが多い。無ければ無いと報告する。
- 既存の内容を消さない。ADR は一度 accepted にしたら書き換えず、覆す場合は新しい ADR を作り、古いほうの `supersededBy` でつなぐ。

書いたら `deno task check` を通し、`docs(<ID>): 恒久ドキュメントへ反映` としてコミットする（他の変更と混ぜない）。反映するものが無ければ、このコミットは作らない。

## 3. PR/MR の本文を作る

specを削除する前に、`assets/pr-body.md` をもとに PR/MR の本文を作る（一時ファイルに書く。リポジトリには置かない）。
要件（EARSの文章）、受け入れ条件の一覧、主な設計判断を、spec から写す。後で spec を参照できるのはこの本文だけである。

## 4. specを削除する

```sh
git rm -r docs/specs/<ID>
```

コミットメッセージは `chore(<ID>): specを削除（恒久ドキュメントへ反映済み）`。

## 5. push して、PR/MR を作る

1. push する（リモートが無ければ省き、その旨を報告する）。
2. 確認ポイントで了承を得ていれば、`docs/sdd/guides/forge.md` に従って PR/MR を作る（本文は手順3のファイルで渡す）。
   了承が無い、または `forge` が無い場合は、タイトルと本文の案を渡す。
3. `assets/squash-message.md` をもとに、squash マージのコミットメッセージの案を作る（PR/MR の URL を入れる）。

**マージと issue のクローズは、ユーザーに頼まれた場合だけ行う。** 頼まれたら `docs/sdd/guides/forge.md` に従い、
squash を指定し、手順5-3のメッセージを渡し、マージ後に作業ブランチを削除する。

## 6. 報告する

次をまとめて報告する。

- 反映した恒久ドキュメント（ファイルごとに、何を追加・変更したか）。反映を見送って提案にとどめたものも書く
- PR/MR の URL（または本文の案）と、squash マージのコミットメッセージの案
- issue に投稿するコメントの文面（`assets/issue-comment.md` をもとに作る）。
  **issue のコメントは issue の関係者に向けて書く。** SDD の内部の手順（drift、basedOn、spec の削除など）は書かない。
  `forge` があり、ユーザーに頼まれた場合は、CLIで投稿する

PR/MR を作った後に変更が入った場合は、`docs/sdd/guides/review-feedback.md` の「PR/MR を作った後に変更が入った場合」に従う。
