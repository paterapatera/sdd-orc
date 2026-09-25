---
name: sdd-steering
description: Maintain docs/steering/ as the project's memory. Do not overwrite text the human wrote.
metadata:
  shared-rules: "rules/steering-principles.md, rules/sync-extensions.md"
---

# Steering

The artifacts are the files under `docs/steering/`. The bars are `rules/steering-principles.md` and `rules/sync-extensions.md`.

Good steering records only principles that recur in the code and the specs. It is not a file list or a copy of one spec. Keep sentences the human wrote. When adding text, separate a contradiction instead of merging it away.

Bad steering deletes a completed spec directory before the human agrees, or adds a policy with no source. Delete a completed spec only after the human decides to delete it and its durable notes are already in steering.
