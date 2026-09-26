---
name: sdd-design-html
description: Optional human command. Build a static HTML preview that groups what design.md creates and updates, by screen or by domain, without changing the markdown. sdd.py next does not start this.
disable-model-invocation: true
---

# Design HTML

Write one static HTML file next to `docs/specs/<feature>/design.md`. Do not change the markdown.

A good preview groups what this design creates and what it updates, by screen or by domain, in the source's own words. A screen is a `## Screens` heading in `requirements.md`. A domain is the stem of a contract path in the Record. A contract or ADR body appears only inside that group, and only when that file is a review surface in `viz-rules.md`. Anything else stays a path. It does not reprint `design.md` heading by heading, and it does not add a component the text does not contain. The bar is `viz-rules.md`.

A bad preview turns each design heading into its own section, invents a screen or a domain, or places a change in a group the text does not name.
