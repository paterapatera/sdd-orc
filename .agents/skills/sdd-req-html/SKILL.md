---
name: sdd-req-html
description: Optional human command. Build a static HTML preview of requirements.md without changing the markdown. Done when the page meets viz-rules.md. sdd.py next does not start this.
disable-model-invocation: true
---

# Requirements HTML

Follow [viz-rules.md](viz-rules.md) only.

Read `requirements.md`, `req-grill.md` when present, [viz-rules.md](viz-rules.md), [template.html](template.html), and [recipes.md](recipes.md). Paste [theme.css](theme.css) into `{{THEME_CSS}}`.

Before writing HTML, state which sections and per-requirement emissions apply, citing only `viz-rules.md`. Write in **Page-level structure** order; before each section, re-read the matching part of `viz-rules.md`. When finished, fix any mismatch with `viz-rules.md`.
