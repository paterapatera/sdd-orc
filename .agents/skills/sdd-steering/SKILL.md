---
name: sdd-steering
description: Maintain docs/steering/ as the project's memory. Do not overwrite text the human wrote.
metadata:
  shared-rules: "rules/steering-principles.md, rules/sync-extensions.md"
---

# Steering

The artifacts are the files under `docs/steering/`. The bars are `rules/steering-principles.md` and `rules/sync-extensions.md`.

Good steering records only rules that recur in the code and the specs. Each rule is `do`, `never`, and `source`. It is not a file list or a copy of one spec. Keep sentences the human wrote. When adding text, separate a contradiction instead of merging it away. Do not copy `docs/settings/templates/steering/` or `docs/settings/templates/steering-custom/` into `docs/steering/` until a source exists.

Bad steering deletes a completed spec directory before the human agrees, adds a policy with no source, or fills a template with a stack this repository has not decided. Delete a completed spec only after the human decides to delete it and its durable rules are already in steering.
