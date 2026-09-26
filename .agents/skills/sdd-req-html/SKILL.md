---
name: sdd-req-html
description: Optional human command. Build a static HTML preview of requirements.md without changing the markdown. sdd.py next does not start this.
disable-model-invocation: true
---

# Requirements HTML

Write one static HTML file next to `docs/specs/<feature>/requirements.md`. Do not change the markdown, `spec.json`, or any other spec file.

A good preview traces requirement ids, the `**Purpose:**` sentence, and each numbered EARS line in the same words as the source. It traces each `## Screens` block's `from`, `items`, `goes`, and `failure` lines, and each Quality and Checks citation, in those same words. Visible headings and column titles stay the localized `{{LABEL_*}}` strings from `viz-rules.md`. `(source: …)` tags stay off the page. Diagrams show only relations that are in the text. The bar is `viz-rules.md`.

A bad preview adds a requirement that is not in the text, shortens a criterion, or draws a transition the `from` and `goes` lines do not state.
