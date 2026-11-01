---
name: sdd-lessons
description: Review lesson candidates and decide adoption, rejection, or hold. Use when a lead runs /sdd-lessons.
---

# sdd-lessons

Docs directory: `__SDD_DOCS_DIR__`. Write bodies in `__SDD_LANG__`. Base branch: `__SDD_BASE_BRANCH__`.

Run `__SDD_RUNTIME__ __SDD_SCRIPT__ check --scope setup` first. Stop unless it passes.

**Audience:** a lead (tech lead, EM, or designated owner), on any cadence (weekly, monthly, or ad hoc). Juniors use **`/sdd-close`** to record only; this skill decides policy adoption.

**Scope:** read and write **`__SDD_KNOWLEDGE_DIR__/lessons/`** only (pages and index). Never edit specs, decisions, steering, or issue directories. Never apply steering changes here — adoption prints a **`/sdd-init ...`** chat line for the person to start a **new issue**.

**Branch:** use a docs branch name that is **not** an issue folder name (for example `docs-lessons-review-2026-11`), or stay on the current branch. Commit as `docs: <description>` in `__SDD_LANG__` on that branch when finished. Do not push or open a pull request from this skill.

## Steps

1. Read every `__SDD_KNOWLEDGE_DIR__/lessons/*.md` page and `lessons/index.md`. Read `__SDD_KNOWLEDGE_DIR__/steering/` when you need wording for the **判断の材料 / Why listed** column (for example whether steering already states the policy). Steering text is **not** a grouping condition.

2. **Present the review** in `__SDD_LANG__` using the fixed structure below (translate headings and column labels; keep column order and group order).

   **Shared term:** **Recurred since last review** means at least one **Occurrence log** date is **after** the **Last reviewed** date (`## Last reviewed`: one `YYYY-MM-DD`). When Last reviewed is **empty** or the section is missing, that phrase does not apply (except for group **D** below, which defines its own rule for `trial` / `effective`).

   **Groups (mutually exclusive — each lesson matches at most one, or none):**

   - **A** — Status `candidate` and Last reviewed is **empty** (never judged in a prior `/sdd-lessons` round). Choices: adopt / reject (Reason required on reject) / hold.
   - **B** — Status `candidate` or `rejected`, Last reviewed is **non-empty**, and **recurred since last review**. Choices: adopt / reject (Reason required on reject) / hold.
   - **C** — Status `trial` and **Review closes** has at least **3** dates **after** the latest **Occurrence log** date. Choices: effective / hold. **Tie:** if a lesson meets both **C** and **D**, list it in **D** only.
   - **D** — Status `trial` or `effective`, and it **recurred since last review**. For `trial` or `effective` with **empty** Last reviewed, treat **every** Occurrence log line as recurrence (the lesson is in **D**). Choices: ineffective (Reason required) / hold.

   **Not listed** (omit from all tables): for example `candidate` or `rejected` with Last reviewed set but **no** log after that date (held or rejected with nothing new); `ineffective`; `effective` with Last reviewed set and **no** log after it; `trial` that meets neither **C** nor **D**.

   Display headings in order **A → B → C → D**; skip empty groups. If every group is empty, say there is nothing to review (one short sentence) and **stop**.

   **Output rules:**
   - One `##` heading per non-empty group:
     - ja: `A 未判断の候補` / en: `A Undecided candidates`
     - ja: `B 前回の見直し以降に再発` / en: `B Recurrence since last review`
     - ja: `C 「有効」に上げられるもの` / en: `C Ready to mark effective`
     - ja: `D 「効かなかった」の候補` / en: `D Ineffective candidates`
   - Under each heading, one Markdown table:
     - ja: `No.` | `教訓` | `状態` | `Target` | `回数` | `最後に起きた日` | `方針` | `判断の材料`
     - en: `No.` | `Lesson` | `Status` | `Target` | `Count` | `Last occurred` | `Policy` | `Why listed`
   - **教訓 / Lesson:** H1 title and `` `slug` ``. **判断の材料 / Why listed:** one line (for example `Last reviewed 2026-11-01 より新しい log`, `Review closes 3件`, or `steering/tech.md に同じ方針あり` — steering match is **informational only**).
   - Number rows **1, 2, 3…** continuously across all groups.

   For each numbered row, show allowed choices (matching the group above) and a recommended default. Ask the lead to reply in **one message** (ja example: `1 採用, 2 効かなかった: 理由, 3 保留`). **Any row not mentioned is hold.**

   See **Example review output** below.

3. **After the lead’s reply**, show a **short summary** (before writing files): Status, Reason, Last reviewed, and every **`/sdd-init`** line you will print. Proceed when clear.

   Apply decisions and **Last reviewed** (today’s date, or the latest **Occurrence log** date reviewed in this session, whichever is **later**):
   - **Hold** (any group): update Last reviewed only; no Status change. A **hold** in **A** or **B** sets Last reviewed so a **later** recurrence (new log after that date) lists the lesson in **B**, not **A**.
   - **Reject (A/B):** Status `rejected`, **Reason** required, **Target unchanged**, Last reviewed as above (later recurrence → **B** if still `rejected` or back to `candidate` only if you changed status — normally **B** for `rejected` with new log).
   - **Adopt (A/B):** Status `trial`, confirm **Target**, Last reviewed as above; print `/sdd-init` or sdd-orc-skill text when Target requires it (same Impact shape as `/sdd-init`).
   - **Effective (C):** Status `effective`, empty Reason, Last reviewed as above.
   - **Ineffective (D):** Status `ineffective`, **Reason** required, Occurrence log unchanged, Last reviewed as above.

4. Write only changed lesson pages under `__SDD_KNOWLEDGE_DIR__/lessons/`. Regenerate the index: `__SDD_RUNTIME__ __SDD_SCRIPT__ index`.

5. Run `__SDD_RUNTIME__ __SDD_SCRIPT__ check --scope knowledge`. Fix validation errors before commit.

6. Commit on the current branch as `docs: <description>` in `__SDD_LANG__`.

Do not delete lesson pages.

### Example review output

Use this shape in `__SDD_LANG__` (ja below). `dev-port`: **A** (candidate, empty Last reviewed). `held-hint`: **B** (candidate, Last reviewed set, new log). `empty-hint`: **D** (trial, empty Last reviewed — recurrence for D).

```markdown
## A 未判断の候補

| No. | 教訓 | 状態 | Target | 回数 | 最後に起きた日 | 方針 | 判断の材料 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 開発ポート競合 `dev-port` | candidate | steering | 1 | 2026-11-01 | steering に正規ポートを書く | 未判断（Last reviewed 空） |

## B 前回の見直し以降に再発

| No. | 教訓 | 状態 | Target | 回数 | 最後に起きた日 | 方針 | 判断の材料 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2 | 保留後に再発 `held-hint` | candidate | steering | 2 | 2026-11-05 | 空状態の案内を必ず出す | Last reviewed 2026-11-01 より新しい log |

## D 「効かなかった」の候補

| No. | 教訓 | 状態 | Target | 回数 | 最後に起きた日 | 方針 | 判断の材料 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 3 | 空一覧の案内不足 `empty-hint` | trial | steering | 2 | 2026-11-02 | 空一覧時は案内文を必ず出す | trial・Last reviewed 空・再発（steering/tech.md に同じ方針あり） |

**おすすめ:** 1 → 採用 / 2 → 採用 / 3 → 効かなかった: 案内は既に steering にある

**返答例:** `1 採用, 2 保留, 3 効かなかった: steering に同方針があるのに再発`（書いていない番号は保留）
```
