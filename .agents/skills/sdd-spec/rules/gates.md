# Copy-paste text

Phase Handoff, Grill 待ち, and PR Summary are defined here. `.agents/skills/sdd-spec/scripts/sdd.py next` decides pass or fail. Emit the fenced text. Fill the slots. Do not rewrite the fixed sentences.

## Phase Handoff

When `action` is `phase-terminal`, emit this and stop.

```markdown
## Phase Handoff

- **終了したフェーズ**: <requirements|design>
- **feature**: <feature>
- **次にやること**: 成果物を確認する。問題があればこのチャットで修正指示。問題がなければ、同じチャットで `/sdd-spec <feature>`
- **読む成果物**:
  - `docs/specs/<feature>/spec.json`
  - `docs/specs/<feature>/requirements.md`
  - `docs/specs/<feature>/reviews/requirements-review.md`
  - （要求のとき）`docs/specs/<feature>/req-grill.md`
  - （設計のとき）`docs/specs/<feature>/design.md`
  - （設計のとき）`docs/specs/<feature>/reviews/design-review.md`
- **残リスク**:
  - <1–3 lines from the review, or なし>
- **禁止**: フェーズ用に新しい worktree を作らない。サブエージェントの中で次のフェーズを始めない
```

## Grill 待ち

When the grill returns `GRILL: WAITING`. This is not a Phase Handoff.

```markdown
## Grill 待ち

- **feature**: <feature>
- **止まった段**: req-grill
- **持ち帰り事項**: `docs/specs/<feature>/req-grill.md` の `## DEFERRED` を1行ずつ
- **次にやること**: 確認がついたら同じ checkout で `/sdd-spec <feature>`。成果物に直接書いてもよい
- **まだ不可**: 要求のレビューと、設計以降
```

## PR Summary Output

After `auto-approve`, before implementation. One fenced `markdown` block the user can paste. Language follows the artifacts; default Japanese. Do not re-analyze. Title, summary, decisions, and residual risks stay short. Acceptance checks are a collapsed transcription of every acceptance criterion in `requirements.md`. Do not summarize, drop, or tabulate them.

- Title is `<feature>: <short scope>`, not a heading inside the body.
- Summary is a few sentences and includes `Spec: docs/specs/<feature>/`.
- One decision per row. Do not paste a long EARS sentence into a cell.
- Residual risks come from `### Accepted residual risks` in the reviews, one sentence each. If none, write `なし`.
- Acceptance checks are a closed `<details>` block. Transcribe every `#### 受け入れ条件` as `- [ ] **<requirement>.<criterion>** <text as written>`. 確認日, 確認者, and 確認対象 stay `（実装後に記入）`. Do not mark `[x]`. Do not invent a verification method.
- The only line after the list is `チェックを入れた項目が確認済み。確認者・確認日は実装後の受け入れ確認で更新する。この一覧は条件の転記のみ。`

Outside the fence, one line: implementation is `/sdd-impl <feature>` on the same checkout. A downstream spec starts from the tip after this spec is on the merge target.

```markdown
タイトル: <feature>: <要約>

## 概要

<feature が実現すること>
Spec: `docs/specs/<feature>/`

## 決定事項と理由

| 決定事項 | 理由 |
| -------- | ---- |
| … | … |

## 残リスク

| リスク | 受容 / 延期の理由 |
| ------ | ---------------- |
| … | … |

<details>
<summary>受け入れ確認（条件の転記。[ ] = 未確認）</summary>

確認日: （実装後に記入）
確認者: （実装後に記入）
確認対象: （実装後に記入）

- [ ] **1.1** …

チェックを入れた項目が確認済み。確認者・確認日は実装後の受け入れ確認で更新する。この一覧は条件の転記のみ。
</details>
```
