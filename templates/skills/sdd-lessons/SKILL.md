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

1. Read every `__SDD_KNOWLEDGE_DIR__/lessons/*.md` page and `lessons/index.md`. Read `__SDD_KNOWLEDGE_DIR__/steering/` when you need to compare Policy text to what is already documented (for group D only).

2. **Present the review** in `__SDD_LANG__` using the fixed structure below (translate headings and column labels; keep column order and group order).

   **Group definitions:**
   - **A** — Status `candidate`.
   - **B** — any **Occurrence log** line dated **after** **Last reviewed** (`## Last reviewed`: one `YYYY-MM-DD` or empty). If Last reviewed is empty or the section is missing, every log line counts.
   - **C** — Status `trial` and **Review closes** has at least **3** dates **after** the latest **Occurrence log** date.
   - **D** — Status `trial` or `effective`, and (B would apply while Policy is already in steering or agreed config/code is in place) or Policy clearly matches steering text.

   **One group per lesson:** assign each slug to **exactly one** group using this **priority** (first match wins): **B** recurrence since last review → **D** ineffective candidate → **A** undecided candidate → **C** ready for effective. A never-reviewed `candidate` with new log activity goes to **B**, not **A**. Display headings still appear in order **A → B → C → D**, but put each lesson only under its assigned group (omit empty headings).

   **Output rules:**
   - One `##` heading per **non-empty** group, in this order only:
     - ja: `A 未判断の候補` / en: `A Undecided candidates`
     - ja: `B 前回の見直し以降に再発` / en: `B Recurrence since last review`
     - ja: `C 「有効」に上げられるもの` / en: `C Ready to mark effective`
     - ja: `D 「効かなかった」の候補` / en: `D Ineffective candidates`
   - Skip empty groups. If all groups are empty, say there is nothing to review (one short sentence in `__SDD_LANG__`) and **stop**.
   - Under each heading, one Markdown table with these columns (translate labels):
     - ja: `No.` | `教訓` | `状態` | `Target` | `回数` | `最後に起きた日` | `方針` | `判断の材料`
     - en: `No.` | `Lesson` | `Status` | `Target` | `Count` | `Last occurred` | `Policy` | `Why listed`
   - **教訓 / Lesson:** H1 title and `` `slug` `` on one line. **回数 / Count:** Occurrences. **最後に起きた日 / Last occurred:** latest Occurrence log date. **方針 / Policy:** one line from Policy. **判断の材料 / Why listed:** one line (for example `Review closes 3件` / `3 Review closes after last log`, or `steering/tech.md に同じ方針あり` / `same policy already in steering/tech.md`).
   - Number rows **1, 2, 3…** across **all** groups (do not restart at 1 per group).

   Then, still in chat, for **each numbered row** show the allowed choices and a recommended default:
   - **A and B:** adopt / reject (Reason required on reject) / hold — recommend adopt for strong new candidates, hold when unsure.
   - **C:** effective / hold — recommend effective when the rule is met.
   - **D:** ineffective (Reason required) / hold — recommend ineffective when steering already covered the policy and it recurred.

   Ask the lead to reply in **one message**, for example:
   - ja: `1 採用, 2 却下: 環境依存のため, 3 保留`
   - en: `1 adopt, 2 reject: environment-only, 3 hold`

   **Any row not mentioned is treated as hold.** Parse adopt/reject/hold/effective/ineffective from that reply (match the language you used in the prompt).

   See **Example review output** at the end of this step.

3. **After the lead’s reply**, show a **short summary** (before writing files): which slugs change Status, Reason, Last reviewed, and every **`/sdd-init`** or sdd-orc-skill improvement line you will print. Wait for confirmation if anything is ambiguous; otherwise proceed to write.

   Apply decisions:
   - **Hold:** set **Last reviewed** to today’s date, or the latest **Occurrence log** date reviewed in this session, whichever is **later**. No Status change.
   - **Reject (A/B):** Status `rejected`, **Reason** required, **Target unchanged** (kept for history), **Last reviewed** as hold.
   - **Adopt (A/B):** Status `trial`, confirm **Target**, **Last reviewed** as hold. Print ready-to-send output (do not edit steering):

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

   - **Effective (C):** Status `effective`, empty Reason, **Last reviewed** as hold.
   - **Ineffective (D):** Status `ineffective`, **Reason** required, Occurrence log unchanged, **Last reviewed** as hold.

4. Write only changed lesson pages under `__SDD_KNOWLEDGE_DIR__/lessons/`. Regenerate the index: `__SDD_RUNTIME__ __SDD_SCRIPT__ index`.

5. Run `__SDD_RUNTIME__ __SDD_SCRIPT__ check --scope knowledge`. Fix any validation errors before commit.

6. Commit on the current branch as `docs: <description>` in `__SDD_LANG__` (for example “review lessons for November”).

Do not delete lesson pages. Work skills continue to read **steering** only, not individual lesson pages (`/sdd-init` may read `lessons/index.md` only per its skill).

### Example review output

Use this shape; write the real text in `__SDD_LANG__` (below is ja). `dev-port` is group **A** only; `empty-hint` is group **B** only (priority B over A).

```markdown
## A 未判断の候補

| No. | 教訓 | 状態 | Target | 回数 | 最後に起きた日 | 方針 | 判断の材料 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 開発ポート競合 `dev-port` | candidate | steering | 1 | 2026-11-01 | steering に正規ポートを書く | 未採用の候補 |

## B 前回の見直し以降に再発

| No. | 教訓 | 状態 | Target | 回数 | 最後に起きた日 | 方針 | 判断の材料 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2 | 空一覧の案内不足 `empty-hint` | trial | steering | 2 | 2026-11-02 | 空一覧時は案内文を必ず出す | Last reviewed 2026-11-01 より新しい log |

**おすすめ:** 1 → 採用 / 2 → 保留

**返答例:** `1 採用, 2 保留`（書いていない番号は保留）
```
