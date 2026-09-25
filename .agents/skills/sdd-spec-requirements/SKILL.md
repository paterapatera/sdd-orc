---
name: sdd-spec-requirements
description: Write requirements.md from the brief. Leave unsettled points as Open question lines. Do not ask the human.
metadata:
  shared-rules: "rules/ears-format.md"
disable-model-invocation: true
---

# Requirements

The artifact is `docs/specs/<feature>/requirements.md`. If `spec.json` is missing, create it with the language and `approvals.requirements.generated: true`. Keep existing keys.

Read the brief, steering when present (`product.md`, `tech.md`, `structure.md`), and `rules/ears-format.md`. Read implementation only for the spot the brief names as existing behavior.

A good requirement states behavior a user or operator can observe. Acceptance criteria use EARS: keywords in English, the rest in the `spec.json` language. Each requirement has a numeric id, 目的, and 受け入れ条件. Where scope could be misread, state what is included and excluded as behavior.

When `details.checks` is set, fix only those items. `tbd` becomes a decision or an `Open question:`. `secret` removes the value. `test` adds an observable criterion within the sources. `boundary` turns `Boundary Candidates` or 境界未定 into a stated boundary or an `Open question:`. `red` removes the leftover mark. Do not add a capability the sources do not have.

Put each unsettled point under `## スコープ境界` as one `Open question:`. Do not invent an acceptance criterion. Transcribe Background only when the brief already has the human's words.

A bad requirement replaces behavior with components, APIs, or screen structure, or adds a purpose the sources do not contain.
