---
name: sdd-task-html
description: Optional human command. Build a static HTML preview that groups what tasks.md creates and updates, by screen or by domain, without changing the markdown. sdd.py next does not start this.
disable-model-invocation: true
---

# Task HTML

Write one static HTML file next to `docs/specs/<feature>/tasks.md`. Do not change the markdown.

A good preview groups each task's creates and updates by screen or by domain, in the source's own words. A screen is a `## Screens` heading in `requirements.md`. A domain is the stem of a path in that task's `contracts`. It does not reprint every task field as its own section, and it does not add a path the task does not list. The bar is `viz-rules.md`.

A bad preview lists tasks in one table with no group, invents a screen or a domain, or places a boundary path in a group the text does not name.
