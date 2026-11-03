# Changelog

## 1.2.0

- Issue readability moves to `docs/issues/<branch>/overview.html`. `requirements.md` and `design.md` keep the 1.1.0 shape; `apply` does not read `overview.html`.
- Add `sdd overview <issue>` to regenerate the generated section (deterministic hash of requirements + design, id lists, questions, steering delta, anchors).
- `/sdd-req` and `/sdd-design` write readable HTML in the agent section between documented markers. `check` validates overview **freshness** (whole file vs regeneration, stale hash, marker layout) and **unknown ids** (requirements, specs, research ADRs) in the agent section only; quick issues skip overview. Run `node .agents/skills/sdd-scripts/sdd.mjs overview <issue>` twice around agent edits (skeleton, then refresh).
- README and README.ja document overview patterns, writing guidance, markers, and remaining `OVERVIEW_*` codes with one-line fixes.

- issue の読みやすさを `overview.html` に移し、`requirements.md` / `design.md` は 1.1.0 の形のままにしました。`apply` は `overview.html` を読みません。
- `sdd overview <issue>` で生成部分（requirements+design のハッシュ、id 一覧、質問、steering デルタ）を更新します。
- `/sdd-req` と `/sdd-design` がマーカー内に読みやすい HTML を書きます。`check` の overview 検査は**鮮度**（欠落・ハッシュ・生成部分・マーカー）とエージェント部分の**未知 id** のみです。表や bullet の形はスキル側の指針です。

## 1.1.0

- Split lesson **recording** from **adoption**: `/sdd-close` only records occurrences, review closes, and new `candidate` lessons; it does not change lesson status or print `/sdd-init`.
- Add bundled skill **`/sdd-lessons`** for leads to adopt, reject, hold, or promote lessons and to print `/sdd-init` follow-ups when steering or config changes are needed.
- Add **`check --scope knowledge`** to validate the knowledge tree (including lessons) on branches without an issue directory; `/sdd-lessons` uses it after edits.
- Lesson pages may include **`## Last reviewed`** (`YYYY-MM-DD` or empty). `/sdd-lessons` sets it when the lead decides; group B is Occurrence log lines after that date. Older pages without the section still pass `check`.
- **`/sdd-lessons`** uses fixed group headings, a numbered review table, and one-line batch replies from the lead.
- `feedback.md` に `##` 見出しが複数ある場合、各エントリの `- Lessons:` 行を close 検査が正しく読めるように `parseFeedbackEntries` を修正しました（最後のエントリだけが処理され、`LESSONS_UNPROCESSED` になる不具合を直します）。
- リポジトリ向けに [CONTRIBUTING.md](CONTRIBUTING.md)（評価・テスト方針）と [AGENTS.md](AGENTS.md) を追加しました（npm パッケージには同梱しません）。
- `/sdd-close` の手順を並べ替え、教訓の記録と `- Lessons:` 記入のあとに `check --stage close` を実行するようにスキル本文を修正しました。
- close 検査では **トップレベル** の `N. Fix:` だけに `- Lessons:` を要求し、ネストした `N.M. Fix:` には要求しないようにしました（`parseFixItems` を合わせて修正）。
- `docs/knowledge/index.md` の Lessons 説明が init と check で英語に揃うようにしました。
- `/sdd-lessons` で各教訓を **1 つのグループだけ** に割り当てるルールを修正しました（A 未判断候補、B 保留・却下後の再発、C trial→effective ※ログ以降の Review closes が 3 件以上かつ Last reviewed **より後の日付**の close が 1 件以上（同日は不可）、D 再発した trial/effective。C と D が両方当てはまるときは D のみ）。

## 1.0.0

- Add project knowledge wiki under `knowledge/lessons/` with issue `feedback.md` capture and `/sdd-close` lesson promotion workflow.
- Extend `check` and `index` for lessons validation and index generation; plain `check` still auto-regenerates `lessons/index.md` when needed and may print an informational note.
- `check --stage close` requires a `- Lessons:` disposition on every `feedback.md` entry and `Fix:` task item (`LESSONS_UNPROCESSED` until approved and recorded).
- Stricter lesson page rules for Occurrences, Occurrence log, Review closes, and Reason; lesson pages must not contain issue or branch names (use dated log lines instead).
- `init`, `update`, and `migrate` create a lessons index when missing.
