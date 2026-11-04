---
name: sdd-close
description: Apply the issue delta to permanent docs and prepare the pull request text. Use when the user runs /sdd-close.
---

# sdd-close

Docs directory: `__SDD_DOCS_DIR__`. Bodies stay in `__SDD_LANG__`. Base branch: `__SDD_BASE_BRANCH__`. Issue directory: `__SDD_DOCS_DIR__/issues/<current-branch>/`.

Run `__SDD_RUNTIME__ __SDD_SCRIPT__ check --scope setup` first. Only this skill updates permanent specs, decisions, and steering for an issue. **`/sdd-close` and `/sdd-lessons` may read** `__SDD_KNOWLEDGE_DIR__/lessons/` (individual pages and the index). Work skills (req, design, task, impl, fix, quick, reverse) do not read lesson pages. Implementation reads the current docs plus the issue delta. Open `__SDD_SCRIPT__` only for a report this skill does not explain.

## Normal close

1. Merge `__SDD_BASE_BRANCH__`. Stop and ask the user to resolve conflicts.
2. Run `__SDD_RUNTIME__ __SDD_SCRIPT__ apply --issue <feature>`. The script allocates ids, rewrites links, regenerates indexes, appends logs without issue names, and replaces provisional ids in Git-tracked code outside the docs directory. It writes nothing when check fails.
3. **Lessons — record only (before removing the issue directory).** Read `feedback.md` when present and every **top-level** `N. Fix:` major in `task.md` (not nested `N.M. Fix:` minors). Read existing `__SDD_KNOWLEDGE_DIR__/lessons/` pages and the index (including `rejected` and `ineffective`). Turn raw notes into durable lesson **records** under `__SDD_KNOWLEDGE_DIR__/lessons/` only (never edit steering here). **Do not change Status** on existing lessons, **do not print `/sdd-init` lines**, and **do not ask adoption questions** — a lead runs **`/sdd-lessons`** on a schedule to adopt, reject, or hold.

   **Search before proposing a new lesson.** Match by title and Policy text against every existing page, including `rejected` and `ineffective`. Reuse or merge into an existing slug instead of creating a duplicate proposal.

   **Never write issue folder names, branch names, or tracker keys into `knowledge/lessons/`** (or any other durable doc). Those names stay in `issues/` only (for example in `feedback.md` dispositions).

   Each lesson page is `lessons/<kebab-slug>.md` with an H1 title and these `##` sections in order: What happened, Why, Policy, Occurrences, Occurrence log, Review closes, Last reviewed, Status, Reason, Target. Status is one of `candidate`, `trial`, `effective`, `ineffective`, `rejected`. Target is one of `steering`, `config-or-code`, `sdd-orc-skill`. **Reason** is required exactly when Status is `ineffective` or `rejected`; leave Reason empty for all other statuses.

   **New lessons:** set Status to `candidate`, a provisional **Target** (best guess), and leave **Last reviewed** empty. Close never updates **Last reviewed** on existing lessons. **Existing lessons:** leave Status, Reason, and Last reviewed unchanged on this skill.

   **Occurrences** counts **events**, not disposition lines: increment **once** per real event, with **one** Occurrence log line, even when `/sdd-fix` records the same event as both a `feedback.md` entry and a **top-level** `Fix:` major (use the same `- Lessons: <slug>` on both; do **not** increment twice). Nested `Fix:` minors under the same major do not add another increment. **Occurrence log** lists each event as `- YYYY-MM-DD: <short description>` using the **close date** of the issue where it was handled (plain language; no issue or branch names). On every recurrence increment Occurrences by one and append one log line. Occurrences must be **≥** the number of log lines. **Review closes** lists `- YYYY-MM-DD` lines only: add one when **this issue** was related to the lesson (the work touched the area the policy covers), you reviewed that lesson during this close, and **no** new Occurrence log line was added for this issue (the prior policy held). Do not add Review closes to lessons you only read while searching unrelated notes.

   Do **not** create lessons for environment-only luck (for example a port already in use), value-only workarounds that skip the root cause (for example “use port 3001”), or one-off choices unique to this issue (leave those as `candidate` only or skip).

   Merge duplicates: increment Occurrences, append an Occurrence log line (or merge into the same slug’s log on recurrence), refine Why or Policy when needed. Do not propose again a policy that already exists on a lesson marked `rejected` or `ineffective`.

   **Confirmation (once per close).** Ask one short factual question only, for example: “Record these lesson entries?” List each entry: slug, new or updated, one-line summary, and whether an occurrence was added. No status-adoption table. Only after confirmation write lesson pages and disposition lines.

   **Dispositions (required for check).** After confirmation, add to each `feedback.md` entry and each **top-level** `Fix:` major in `task.md` exactly one line (nested `N.M. Fix:` minors do not get their own line):
   - `- Lessons: <kebab-slug>` when the entry became (or updated) that lesson, or
   - `- Lessons: excluded: <short reason>` when nothing durable was recorded.

   Commit `feedback.md` and `task.md` on the branch when you add dispositions. Write or update lesson pages and regenerate `lessons/index.md` with `__SDD_RUNTIME__ __SDD_SCRIPT__ index`; **stage and commit** those lesson files together with the disposition commit (or include them in the final close commit in step 5 if you have not committed them yet).

   **Repeated-check diagnostic:** when the same checker rule code hits the same file path on **two consecutive** `check` runs for this issue, treat it as a recurrence signal for lessons (same kind of failure as before).

   Lessons that recurred while already `trial` or `effective` are recorded here (log + count only). **`/sdd-lessons`** decides later whether steering already covers the policy and whether status should move to `ineffective` or stay on trial.

4. Run `__SDD_RUNTIME__ __SDD_SCRIPT__ check --stage close --issue <feature>`. Stop and report the cause on failure (`LESSONS_UNPROCESSED` means a missing disposition from step 3). A base mismatch means `/sdd-fix` at L2: delete the stale `base:` line, stamp, and retry.
5. Read the proposal, requirements, and design for the pull request text. **Before deleting the issue directory**, run `__SDD_RUNTIME__ __SDD_SCRIPT__ fp --issue <feature> --format json` and keep the result for step 6. Delete the issue directory and commit as `docs: <description>` with the description in `__SDD_LANG__`; a tracker key prefix becomes the scope. Stage permanent docs (including all `knowledge/lessons/` pages, `lessons/index.md`, and the final `feedback.md` / `task.md` commits if not already pushed), code whose provisional ids changed, and the issue deletion. Do not use `git add -A`.
6. Print only the pull request title and body, each in its own fenced code block so the user can copy it: the title in a `text` block, then the body in a `markdown` block. Use a longer fence, such as four backticks, when the body itself contains a fence. Title is `【<key>】<proposal title>` when the feature name has a tracker key, otherwise the proposal title. Build the body from the proposal's Why, What Changes, and Out of Scope, rewritten to what the requirements and design settled; drop choices the proposal left open and list the added ADRs by title. Add `Post-merge verification` checkboxes for CI and Staging rows from Testing Strategy. **Function points:** after the main narrative, add a short section in `__SDD_LANG__` from the step 5 `fp` JSON. When `skipped` is true with `reason` `quick_issue`, write one line that function points are **not counted** for quick issues. Otherwise use `summary.total`, `summary.points`, and `summary.itemCounts` for DATA, REQ, IF_CONSUMED, and IF_PROVIDED (ADDED / MODIFIED / REMOVED **item counts** per kind, plus FP per kind). If `summary.ifUnset` has any items, add one line for **IF unset** (0 FP). Include one line that this is a custom NESMA-estimated-based count with REQ fixed at 4 FP (not IFPUG/NESMA). Do not print `Closes #n`, and do not push or open the pull request.

Stop when any major task is unchecked. A docs-only issue skips task completion and Post-merge verification, and stops while Open Questions remain. Quick issues run the same lessons step; if `knowledge/lessons/` is missing on the branch, close creates `lessons/index.md` when needed. After close, further changes are a new issue.

## Re-close

Use this mode when the issue directory is gone and this branch already has a close commit.

1. Merge `__SDD_BASE_BRANCH__`.
2. Resolve permanent-doc conflicts by keeping both requirements and ADRs, ordering `log.md` by date, and keeping either `index.md`. For `knowledge/lessons/`, keep the union of lesson pages, merge Occurrence log and Review closes without duplicate date lines, reconcile Occurrences to match log count, and never delete a lesson. When two versions of the same lesson conflict, **negative evidence wins**: use status precedence `rejected` > `ineffective` > `effective` > `trial` > `candidate` (`rejected` is a human decision; `ineffective` is newer evidence that the policy did not work). Keep the **Reason** from the winning negative version when either side is `rejected` or `ineffective`; otherwise keep the higher-precedence side’s Reason if present. Stop for code conflicts.
3. Do not re-run raw feedback collection (there is no issue directory). Do not duplicate lessons that the first close already wrote.
4. Run `__SDD_RUNTIME__ __SDD_SCRIPT__ renumber --base __SDD_BASE_BRANCH__`. It renumbers only ids this branch added that collide with the base, and it does not change ids already on the base. When it stops for a capability code collision, propose a new code, get confirmation, and rerun with `--code OLD=NEW`.
5. Run `__SDD_RUNTIME__ __SDD_SCRIPT__ index`, then `__SDD_RUNTIME__ __SDD_SCRIPT__ check --stage close --allow-missing`, then commit as `docs: <description>` in `__SDD_LANG__`. (`check` also refreshes stale indexes when you run it; Re-close still runs `index` explicitly after merge resolution.)

This package recommends that pull request CI run `check` as a required status check, and that the base branch be up to date before merge. Those are not requirements, and they are not part of the close output.
