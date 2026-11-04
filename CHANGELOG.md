# Changelog

## 1.2.2

- **`/sdd-close`:** drop the one-line custom-metric disclaimer from the printed pull request **Function points** section (README still describes NESMA estimated weights and that the count is not IFPUG/NESMA-certified).

## 1.2.1

- Add **`sync-base`** on the bundled checker: before close merges the base branch, fetch from the remote and fast-forward the **local** `baseBranch` ref (default `main`) without checking it out. Uses an explicit remote-tracking refspec; updates local base via `git fetch .` so git refuses when the base is checked out in any worktree. Stops when fetch fails or when local base is ahead/diverged from the remote; uses the sole remote when there is only one (even if it is not named `origin`); stops and lists remotes when several exist and upstream is unset; skips with a note when no remote exists.
- **`/sdd-close`** (normal and re-close) runs `sync-base` before merging the base branch so `renumber`, `apply`, and `fp` see an up-to-date local base.
- README / README.ja document why close syncs base first and update **known limits** case (1): missing or stale local base is handled on `/sdd-close`; manual `fp` without a local base can still show 0 FP lines.

## 1.2.0

- Add **`fp`** command on the bundled checker: mechanical **custom function point (FP)** count per issue from the requirements delta (NESMA estimated weights). Output goes to **stdout** only (text or `--format json`); nothing is written into `requirements.md`.
- Count **elementary processes** (grouped by `- Process:` on issue delta `REQ-*`): **EI** 4, **EO** 5, **EQ** 4 each distinct process; **Process: none** and unknown legacy REMOVED processes **0**. DATA **7**, IF Consumed **5**, IF Provided **4**, NFR and steering **0**. **`check`** requires `Process` on ADDED/MODIFIED `REQ-*`; permanent specs without `Process` stay valid. **Upgrading:** add `- Process:` to ADDED/MODIFIED REQs in any in-progress issue before re-running `check`.
- Fix **`fp`** process buckets: base lookup uses **`git show` only** (not the working tree after apply); MODIFIED when the issue has MODIFIED/REMOVED REQs or the name exists on the base branch.
- Document the metric in README and README.ja (junior-friendly; Japanese in です/ます style).
- **`/sdd-close`** runs `fp --format json` before removing the issue directory and adds a short function-points section to the printed pull request body (quick issues: one line that FP is not counted).
- Fix **`fp`** counting: provisional `-NEW-` ids, **REMOVED** IF direction from base-branch `interfaces.md` (stable after apply), dedupe duplicate rows and one id per file (REMOVED>MODIFIED>ADDED); report **IF unset** when Direction is missing.
- README / README.ja document **known limits** when REMOVED `IF-*` lookup fails (each appears as **IF unset (0 FP)** in output).
- Pull request **Function points** section from `/sdd-close` adds an **NFR** line with ADDED/MODIFIED/REMOVED item counts (0 FP) when the issue delta includes NFR items.

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
