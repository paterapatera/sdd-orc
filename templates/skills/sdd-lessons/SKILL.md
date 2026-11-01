---
name: sdd-lessons
description: Review lesson candidates and decide adoption, rejection, or hold. Use when a lead runs /sdd-lessons.
---

# sdd-lessons

Docs directory: `__SDD_DOCS_DIR__`. Write bodies in `__SDD_LANG__`. Base branch: `__SDD_BASE_BRANCH__`.

Run `__SDD_RUNTIME__ __SDD_SCRIPT__ check --scope setup` first. Stop unless it passes.

**Audience:** a lead (tech lead, EM, or designated owner), on any cadence (weekly, monthly, or ad hoc). Juniors use **`/sdd-close`** to record only; this skill decides policy adoption.

**Scope:** read and write **`__SDD_KNOWLEDGE_DIR__/lessons/`** only (pages and index). Never edit specs, decisions, steering, or issue directories. Never apply steering changes here — adoption prints a **`/sdd-init ...`** chat line for the person to start a **new issue**.

**Branching:** work on a short docs branch (for example `docs/lessons-review-2026-11`), same as other knowledge edits. Commit as `docs: <description>` in `__SDD_LANG__`, run `check`, push, and open a PR. If your project allows direct commits to the base branch for docs-only lesson status updates, you may commit there instead; prefer a PR when CI or review is required.

## Steps

1. Read every `__SDD_KNOWLEDGE_DIR__/lessons/*.md` page and `lessons/index.md`. Read `__SDD_KNOWLEDGE_DIR__/steering/` when you need to compare Policy text to what is already documented (for ineffective candidates only).

2. **Present grouped lists** (skip empty groups). For each item show slug, Status, Target, one-line Policy summary, and why it appears in that group.

   **A. Undecided candidates** — Status `candidate` (not yet adopted to trial).

   **B. New activity since last review** — Occurrences or Occurrence log grew since the last time a lead ran this skill (compare log dates and counts; if unsure, treat any new log line or increment since the last `docs:` lesson review commit on the base branch as new activity).

   **C. Trial → effective** — Status `trial` and **Review closes** has at least **3** date lines **after** the date on the latest **Occurrence log** line (three later closes reviewed the lesson without a new occurrence). Propose moving to `effective`.

   **D. Ineffective candidates (computed, no extra field)** — Status `trial` or `effective`, and **either** a new Occurrence log line was added on a recent close while the lesson’s Policy is already reflected in steering (or the agreed config/code fix is in place), **or** the same failure pattern clearly matches steering that already states the policy. Compare Policy wording to steering files; do not guess from memory. These are candidates to mark `ineffective` with a Reason, not automatic status changes.

3. For each listed item (or batch), ask the lead to choose **adopt**, **reject**, or **hold**.

   - **Hold:** no file change for that slug this round.
   - **Reject:** set Status `rejected`, require **Reason**, clear Target if you standardize rejected pages (Reason required; Target may stay for history).
   - **Adopt:** set Status `trial`, confirm **Target** (`steering`, `config-or-code`, or `sdd-orc-skill`). Then print ready-to-send output (do not edit steering):

     **Target `steering` or `config-or-code`:** one agent chat line plus the Impact block shape from `/sdd-init`:

     ```text
     /sdd-init <short title for the steering or config change>
     ```

     ```markdown
     ## Impact

     - Type: docs
     - Capabilities: none
     - Steering: /steering/tech.md
     - Decisions: none
     - Code: none
     ```

     Adjust Type, Capabilities, Steering, Decisions, and Code to match the real follow-up issue (same rules as `/sdd-init`).

     **Target `sdd-orc-skill`:** print an improvement request for the `@paterapatera/sdd-orc` package (bundled skill change), not a project-local skill edit — project skill dirs are overwritten by `npx @paterapatera/sdd-orc update`.

   - **Trial → effective:** when the lead confirms group C items, set Status `effective` (Reason empty).

   - **Ineffective:** when the lead confirms group D items, set Status `ineffective`, require **Reason**, keep Occurrence log as recorded by close.

4. Write only changed lesson pages under `__SDD_KNOWLEDGE_DIR__/lessons/`. Regenerate the index: `__SDD_RUNTIME__ __SDD_SCRIPT__ index`.

5. Run `__SDD_RUNTIME__ __SDD_SCRIPT__ check`. Fix any lesson validation errors before commit.

6. Commit on the docs branch as `docs: <description>` in `__SDD_LANG__` (for example “review lessons for November”). Push and open a PR if your workflow uses one.

Do not delete lesson pages. Work skills continue to read **steering** only, not individual lesson pages (`/sdd-init` may read `lessons/index.md` only per its skill).
