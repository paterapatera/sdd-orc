---
name: sdd-req-html
description: Optional human command. Build a static HTML preview of requirements.md without changing the markdown. sdd.py next does not start this.
disable-model-invocation: true
---

# Requirements HTML

Write one static HTML file next to `docs/specs/<feature>/requirements.md`. Do not change the markdown, `spec.json`, or any other spec file.

A good preview traces requirement ids, the `**Purpose:**` sentence, and each numbered EARS line in the same words as the source. On a screen card, item names are the nouns on the items line, each with a kind the line's own words support (`入力`, `操作`, `表示`, or a widget word already written there). It traces each Quality and Checks citation as that criterion's response, under the gloss name, after the requirements. Visible headings and column titles stay the localized `{{LABEL_*}}` strings from `viz-rules.md`. `(source: …)` tags stay off the page. Diagrams show only relations that are in the text. The bar is `viz-rules.md`.

A bad preview adds a requirement that is not in the text, shortens a criterion, draws a transition the `from` and `goes` lines do not state, or calls a field a button, a radio, or an alert when the sentence does not.
