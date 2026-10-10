# スキルの変更の採否

却下した変更も残す（同じ提案を繰り返さないため）。新しいものを下に追記する。

採用の条件:

1. このリポジトリの `deno task test`、`deno fmt --check`、`deno lint` が通る
2. 狙ったパターンの train の問題で、合格の回数が増えた
3. val の問題で、合格の回数が減っていない（`deno task eval:summary` で比べる）

| 日付 | 対象のパターン | 変更（コミット、または差分の要約） | 変えた場所 | train の結果（前 → 後） | val の結果（前 → 後） | 採否 |
|---|---|---|---|---|---|---|
| 2026-10-10 | P-001 | config.ts をコミットするとき、pre-commit hook が `gate --if-changed`（format を除き E2E を含む）を流し、通らなければ中止する。`gate --full` が通ったら `.sdd/gate-passed.json` に記録し、commands が同じなら流さない。sdd-init の手順6と確認ポイントに追記 | `assets/sdd/scripts/gate.ts`、`pre-commit.sh`、`sdd-init/SKILL.md` | INIT-001: 合格 0/3 → 0/3。gate の項目は 0/3 → 3/3。新たに app-unchanged が 3/3 で落ちた（P-003。基準のコードが品質ゲートを通らないことが一因）。P-003 の対策と合わせて 3/3 | （val の問題がまだ無い） | 採用（P-003 の対策と合わせて） |
| 2026-10-10 | P-003 | 導入のコミット（HEAD に config.ts が無い）に docs/sdd/、.agents/、.gitignore 以外が含まれると pre-commit hook が中止する。sdd-init の手順6で、品質ゲートが通らない原因をコマンドの誤りと既存のコードに分け、既存のコードは直さずに聞く。確認ポイント6を更新 | `assets/sdd/scripts/pre-commit.sh`、`sdd-init/SKILL.md` | INIT-001: 0/3 → 3/3（スキル cc870e8+変更(b4c5510)）。3回とも、品質ゲートが既存のコードで落ちると止まって聞き、PHP 側だけの check を登録した | （val の問題がまだ無い） | 採用 |
| 2026-10-10 | P-004 | drift の最上位のディレクトリの比較で、docs/sdd と docs/specs の下だけでできたディレクトリを数えない | `assets/sdd/scripts/drift.ts` | QUICK-001: drift の報告を受けた質問 6/6（772db1e、道具が届いていなかった 42f0482）→ 0/3（1a21ed9）。合格は 3/3 → 0/3 だが、落ちたのは P-005（呼び出しの文面が「受け入れOK」から「OK」に変わった）で、drift とは関係しない | （val の問題がまだ無い） | 採用 |
| 2026-10-10 | P-005 | sdd-finish の確認ポイントに、回答があるとみなしてよい場合を項目ごとに書いた（PR/MR の作成は、PR/MR を作ることへの言及があるときだけ）。「OK」などの短い了承は受け入れテストへの回答にしかならないと明記。QUICK-001 の呼び出しの文面を「OK /sdd-finish」に揃えた | `sdd-finish/SKILL.md` | QUICK-001: 0/3（1a21ed9、聞かずに PR を作った 3/3）→ 再実行で確かめる | （val の問題がまだ無い） | 評価待ち |
