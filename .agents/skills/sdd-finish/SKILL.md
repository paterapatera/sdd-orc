---
name: sdd-finish
description: SDD（仕様駆動開発）でissueの作業を完了する。受け入れテストの合格後に、長く残す知識を恒久ドキュメント（ADR、architecture など）へ反映し、開いている PR/MR の本文を合格の要約に更新し、docs/specs/<issue> を削除して、その PR/MR を squash マージする。ユーザーが sdd-finish の実行を明示的に指示した場合にだけ使う。
disable-model-invocation: true
---

# sdd-finish

specは squash マージの前に削除するので、main の履歴には残らない。代わりに次で残す。

1. 恒久ドキュメント（`docs/sdd/`）への反映（必須）
2. **開いている PR/MR の本文を、spec の要約に更新する**（要件、受け入れ条件、主な設計判断）。実装完了で開いた本文は、受け入れの前の要約である
3. squash マージのコミットメッセージに、issue の ID と PR/MR の URL を入れる

HTML や zip を issue や PR/MR に添付することは**しない**。

このスキルのファイル:

- `assets/pr-body.md`: PR/MR の本文のひな形（spec の要約）
- `assets/squash-message.md`: squash マージのコミットメッセージのひな形
- `assets/issue-comment.md`: issue に投稿するコメントのひな形

対象リポジトリの手引き:

- `docs/sdd/guides/forge.md`: ホスティングのCLI（PR/MR の作成、squash マージ）の使い方
- `docs/sdd/guides/issues.md`: issue の取得、コメント、クローズ（省略時は `gh`。`forge` とは別でよい）
- `docs/sdd/guides/review-feedback.md`: PR/MR を作った後に変更が入った場合

道具は、リポジトリのルートで `bun docs/sdd/scripts/<タスク名>.ts` として実行する。render は `bun docs/sdd/render/main.ts` である。

## 確認ポイント

ユーザーの回答を待つのは、**開始時の1回だけ**。次をまとめて聞き、回答を受け取るまで先に進まない
（質問ツールがあれば使い、これらは1回にまとめてよい）。

1. 受け入れテストに合格したか（生成したページの「受け入れテスト」の章の項目をすべて確かめたか）
2. 未コミットの変更がある場合: それを含めてよいか（受け入れテスト中の修正などは、内容を示して確認する）

スキルを呼び出したこと（`/sdd-finish`）は、確認ポイントへの回答ではない。
すでに回答があるとみなしてよいのは、次の場合だけ。それ以外は、その項目を必ず聞く。

- 1: ユーザーの発言に、受け入れテストの結果（「合格」「OK」「問題ない」など）がある
- 2: ユーザーの発言に、未コミットの変更の扱いへの言及がある

**「OK」「受け入れOK」「進めて」のような短い了承は、1への回答にしかならない。** 2への回答として扱わない。

守ること（試行で崩れた点）: 短い了承を、未コミットの変更を含めてよいという意味にしない。
受け入れに合格していると確認できたら、のちの手順で開いている PR/MR を取り込む。取り込みを別の質問にしない。新しい PR/MR は作らない。
受け入れテストが不合格・未実施なら止まり、不合格の内容をチャットで伝えてもらう（sdd-impl で直す）。反映、spec の削除、マージはしない。開いている PR/MR は閉じない。

確認の後は止まらずに最後まで進め、行ったことを最後に報告する。

## 1. 前提を確かめる

1. `bun docs/sdd/scripts/current.ts` で issue の ID を特定する。
2. 確認ポイントの質問をして、回答を受け取る。
3. 未コミットの変更を含めてよいと回答された場合は、`bun docs/sdd/scripts/gate.ts` を通してから、内容に合ったメッセージでコミットする
   （受け入れテストでの指摘の反映なら `fix(<ID>): 指摘を反映`。恒久ドキュメントの変更と混ぜない）。
4. 材料を洗い出す（finish-report は品質ゲート `gate --full` も実行する）:
   ```sh
   bun docs/sdd/scripts/finish-report.ts <ID>
   ```
   「完了の条件」にエラーがあれば直す。よくあるもの:
   - 完了したタスクにコミットが無い、空のコミットがある → 1タスク＝1コミットになっていない。タスクを統合するなど、spec を実態に合わせる
   - 影響範囲の外の変更がある → spec の impact を直す
   - 未確定の点（openQuestions）が残っている → 受け入れテストに合格しているなら、解消済みの内容で要件を直す。判断できなければユーザーに聞く
   - 依存関係の定義が変わったのに ADR にする設計判断が無い → ユーザーに質問し、design.ts の decisions に理由と代替案を書く
   - 品質ゲートを緩めた変更がある → 元に戻す。必要ならユーザーに質問し、decisions の `relaxesQualityGate` に書く
   - 品質ゲートでテストを除外している → 除外を戻す。戻せないときはユーザーに質問し、完全モードならそのファイルを decisions の `relaxesQualityGate` に書く。軽量モードには decisions が無いので戻す
   - この issue の不変条件を規約の rule に写している → その rule を規約から外す。プロジェクト全体の基準は nfr.ts、設計判断は ADR に、受け入れた文面のまま移す
   - 採用済みの ADR を書き換えている → 元に戻し、覆すなら新しい ADR を作る
5. `finish-report` の「手で守る規約」に出た守り方どおりに実装されているかを、コードで確かめる。守られていなければ直し、
   品質ゲートを通してコミットする（`fix(<ID>): 規約に合わせて修正`）。

## 2. 恒久ドキュメントへ反映する

`finish-report` の結果をもとに、AIが判断して反映する（了承は求めない。反映した内容は最後に報告する）。

| 対象 | 反映する内容 |
|---|---|
| `docs/sdd/adr/ADR-xxxx.ts` | design.ts の decisions のうち `adr: true` のもの。`issue` にこの issue の ID を書く。ひな形は `.agents/skills/sdd-init/assets/templates/adr/ADR-0001.ts` |
| `docs/sdd/architecture.ts` | 新しいモジュール、モジュールの責務の変化、技術スタックの追加、削除したもの。`updatedAt` を今日の日付にする |
| `docs/sdd/conventions.ts` | このissueで新しく決め、今後も守る規約（ADRと対になることが多い）。1つのissueで一度使っただけのやり方は規約にしない。この issue の invariants の behavior を rule に写さない |
| `docs/sdd/nfr.ts` | 非機能要件のうち、プロジェクト全体の基準にすべきもの。判断がつかなければ反映せず、報告で提案する |
| `docs/sdd/config.ts` | 品質ゲートのツールを導入・変更した場合は `commands` |

- **architecture.ts の `basedOn` は変更しない。** squash マージでブランチのコミットのハッシュが変わるため。
  次の sdd-start の drift の確認で、反映済みであることを確かめてから main のコミットに進める。
- 軽量モードでは、反映するものが無いことが多い。無ければ無いと報告する。
- 既存の内容を消さない。ADR は一度 accepted にしたら書き換えず、覆す場合は新しい ADR を作り、古いほうの `supersededBy` でつなぐ。

書いたら `bun docs/sdd/scripts/check.ts` を通し、`docs(<ID>): 恒久ドキュメントへ反映` としてコミットする（他の変更と混ぜない）。反映するものが無ければ、このコミットは作らない。

反映のあと（反映が無ければそのままで）、もう一度 `bun docs/sdd/scripts/finish-report.ts <ID>` を実行する。完了の条件にエラーがあれば直してから先に進む。ここを通過するまで、本文の更新と spec の削除とマージには進まない。

## 3. PR/MR の本文を合格の要約に更新する

specを削除する前に、`assets/pr-body.md` の「合格のあと」をもとに本文を作る（一時ファイルに書く。リポジトリには置かない）。
要件（EARSの文章）、受け入れ条件の一覧、`verifiedBy` が `human` の変えてはいけない振る舞い、主な設計判断を、spec から写す。
`finish-report` の「PR本文に抜き出す変えてはいけない振る舞い」を、文面のまま本文に書く。これらは規約に写さない。
人が受け入れテストで確かめたことを本文に書く。
後で spec を参照できるのはこの本文だけである。
開いている PR/MR があれば、`docs/sdd/guides/forge.md` に従って本文をこの内容に更新する。無ければ、タイトルと本文の案として持ち、新しくは作らない。

## 4. specを削除する

```sh
git rm -r docs/specs/<ID>
```

コミットメッセージは `chore(<ID>): specを削除（恒久ドキュメントへ反映済み）`。

## 5. push して、開いている PR/MR をマージする

1. push する（リモートが無ければ省き、その旨を報告する）。
2. `assets/squash-message.md` をもとに、squash マージのコミットメッセージを作る（PR/MR の URL を入れる）。
3. 開いている PR/MR があり、`forge` があるときは、`docs/sdd/guides/forge.md` に従って squash マージする。
   手順5-2のメッセージを渡し、マージ後に作業ブランチを削除する。了承は重ねて聞かない。新しい PR/MR は作らない。
4. 開いている PR/MR が無い、または `forge` が無いときは、マージしない。タイトル、本文、squash のメッセージの案を渡す。

**issue のクローズは、ユーザーに頼まれた場合だけ行う。** 頼まれたら `docs/sdd/guides/issues.md` に従う（`manual` のときはユーザーに頼む）。

## 6. 報告する

次をまとめて報告する。

- 反映した恒久ドキュメント（ファイルごとに、何を追加・変更したか）。反映を見送って提案にとどめたものも書く
- PR/MR の URL とマージの結果（マージしていないときは、タイトル、本文、squash のメッセージの案）
- issue に投稿するコメントの文面（`assets/issue-comment.md` をもとに作る）。
  **issue のコメントは issue の関係者に向けて書く。** SDD の内部の手順（drift、basedOn、spec の削除など）は書かない。
  `issues.cli` が `manual` でなければ、ユーザーに頼まれた場合は `docs/sdd/guides/issues.md` の CLI で投稿する（省略時は `gh`）

PR/MR を作った後に変更が入った場合は、`docs/sdd/guides/review-feedback.md` の「PR/MR を作った後に変更が入った場合」に従う。
