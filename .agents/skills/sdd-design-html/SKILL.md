---
name: sdd-design-html
description: Optional human command. Build a static HTML preview of design.md without changing the markdown. sdd.py next does not start this.
disable-model-invocation: true
---

# Design HTML

Write one static HTML file next to `docs/specs/<feature>/design.md`. Do not change the markdown.

A good preview traces boundaries, structure, and requirement links under the same names as the source. Detail may be collapsed. It does not add a component the text does not contain. The bar is `viz-rules.md`.

A bad preview re-judges the design or fills a section the text does not have.
