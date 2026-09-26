---
name: sdd-req-html
description: Optional human command. Build a static HTML preview of requirements.md without changing the markdown. sdd.py next does not start this.
disable-model-invocation: true
---

# Requirements HTML

Write one static HTML file next to `docs/specs/<feature>/requirements.md`. Do not change the markdown, `spec.json`, or any other spec file.

A good preview traces requirement ids, the `**Purpose:**` sentence, and each numbered EARS line in the same words as the source. Visible headings and column titles stay the localized `{{LABEL_*}}` strings. Diagrams show only relations that are in the text. The bar is `viz-rules.md`.

A bad preview adds a requirement that is not in the text, or shortens a criterion.
