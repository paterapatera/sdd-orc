---
name: sdd-req-html
description: Optional human command. Build a static HTML preview of requirements.md without changing the markdown. Done only when CHECKLIST.md passes. sdd.py next does not start this.
disable-model-invocation: true
---

# Requirements HTML

Write one static HTML file next to `docs/specs/<feature>/requirements.md`. Do not change the markdown, `spec.json`, or any other spec file.

A good preview traces requirement ids, the `**Purpose:**` sentence, and each numbered EARS line in the same words as the source. On a screen card, item names are the nouns on the items line, each with the control that leaf already writes (`テキスト入力`, `テキストエリア`, `セレクトボックス`, `ラジオボタン`, `チェックボックス`, `ボタン`, or `表示`). Do not replace a written control with `入力`. It traces each Quality and Checks citation as that criterion's response, under the gloss name, after the requirements. Visible headings and column titles stay the localized `{{LABEL_*}}` strings from `viz-rules.md`. `(source: …)` tags stay off the page. Read `req-grill.md` `## Human choices` and mark each transcribed answer as `viz-rules.md` says, with the question and the answer in the hover bubble. Diagrams show only relations that are in the text. The bar is `viz-rules.md`.

A bad preview adds a requirement that is not in the text, shortens a criterion, draws a transition the `from` and `goes` lines do not state, calls a field a control the sentence does not name, or turns `項目直下のインラインテキスト` or `ダイアログ` into `表示`. The file existing is not done.

## Procedure

Read [viz-rules.md](viz-rules.md) and [template.html](template.html) before writing. [CHECKLIST.md](CHECKLIST.md) is the completion gate. Do not build the page with a throwaway script. A script that emits HTML does not replace this procedure.

### Phase A — before writing

Read `requirements.md`, `req-grill.md` when it exists, and `viz-rules.md`. Then write the output plan, and do not write HTML until that plan is stated:

- TOC entries, in page order, and the sections omitted because the source is empty
- Whether the screen transition flowchart is emitted, and which edges, one sentence each
- For each requirement: flowchart, state diagram, decision table — emit or omit, with the viz-rules condition that decides it
- Coverage row count, Quality keys then Checks keys, in source order
- Human choices that will be marked, and those that will go to `grill-left`

A stub with no numbered EARS lines uses the stub rule in `viz-rules.md`. Say that, and skip the diagram plan.

### Phase B — writing

Fill `template.html` in its section order. For each section, re-read the matching part of `viz-rules.md`, then write that section. Do not generate the page in one pass and patch it afterward. Do not merge partial fragments that were not checked against the rule for that section.

### Phase C — after writing

Run every item in [CHECKLIST.md](CHECKLIST.md). Fix any miss, then run the list again. Done means every item passes. A file on disk with an open item is not done.
