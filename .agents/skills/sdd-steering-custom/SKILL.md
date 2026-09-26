---
name: sdd-steering-custom
description: Optional human command. Write one steering file other than product.md, tech.md, and structure.md. sdd.py next does not start this.
disable-model-invocation: true
metadata:
  shared-rules: "rules/steering-principles.md"
---

# Extra steering

Write one file under `docs/steering/` for the domain the human named. The bar is `rules/steering-principles.md`. The shape is the matching file under `docs/settings/templates/steering-custom/`: `do`, `never`, and `source`.

A good file states only rules that apply again in that domain and already have a source. It does not copy product, tech, or structure. It does not delete text the human already wrote. If no source exists, write nothing.

A bad file copies one spec's design, expands into a domain the human did not ask for, or keeps an empty `do` / `never` / `source` slot.
