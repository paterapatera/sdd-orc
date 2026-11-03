# Changelog

## 1.2.0

- **`/sdd-req` readability:** `# Summary` with open-question (and optional undecided) count, `## Role and screen map`, named Proposal Coverage lines, answered Open Questions in `<details>` after `# Delta`, and `check` rules to keep ids aligned (`REQ_READABILITY_*`, `ROLE_MAP_*`, `SUMMARY_*`, `OPEN_QUESTIONS_IN_DETAILS`). Issues without `# Summary` keep the previous shape.
- **`/sdd-design` readability:** `## Steering changes at a glance` before `# Delta`, optional Name column in Requirements Traceability, and `STEERING_GLANCE*` checks on the design delta only.
- `apply` still reads only `# Delta`; Summary, maps, and `<details>` never land in permanent specs or steering.

## 1.2.0（日本語）

- **`/sdd-req`:** 冒頭に `# Summary`（未回答件数・任意で未決定件数）と `## Role and screen map`、Proposal Coverage の id＋短い名称、回答済み Open Questions は `# Delta` 以降の `<details>` へ。`check` で Summary／マップ／Coverage と delta の id ずれを検出（セル文言の良し悪しは見ません）。`# Summary` がない issue は従来どおり。
- **`/sdd-design`:** `# Delta` 直前に `## Steering changes at a glance`、Requirements Traceability に Name 列（任意）。steering 変更は design delta と glance の対応を `check`。
- **`apply`:** 恒久 docs へ書き込むのは従来どおり delta のみ（Summary 等は混入しません）。

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
