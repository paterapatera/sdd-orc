---
name: sdd-spec-requirements
description: Write requirements.md from the brief. Leave unsettled points as Open question lines. Do not ask the human.
metadata:
  shared-rules: "rules/ears-format.md, rules/quality.md"
disable-model-invocation: true
---

# Requirements

The artifact is `docs/specs/<feature>/requirements.md`. If `spec.json` is missing, create it from `docs/settings/templates/specs/init.json` with the language and `approvals.requirements.generated: true`. Keep existing keys, including `path`, `proposed_speed`, and `scale`.

Read the brief, steering when present (`product.md`, `tech.md`, `structure.md`), `rules/ears-format.md`, and `rules/quality.md`. Read implementation only for the spot the brief names as existing behavior.

A good requirement states behavior a user or operator can observe. Each requirement is `## <number>. <name>`, one `**Purpose:**` sentence, and one numbered EARS line per behavior. The label and the EARS keywords stay in English. The purpose sentence and the EARS variable parts follow `spec.json` `language`. Use `When`, `If`, `While`, `Where`, or a bare `shall` only for a behavior that exists. Do not emit the other patterns. `## Boundary` `in:` is behavior inside this feature. `out:` is behavior outside this feature, the same kind of statement as the brief's Scope Out. A type, a range, a storage choice, or a design-review note is not an `out:`. Do not write `source: design-review`.

When `details.checks` is set, fix only those items. `tbd` becomes a decision or an `Open question:`. `secret` removes the value. `test` adds an observable criterion within the sources. `boundary` turns `Boundary Candidates` or 境界未定 into a stated boundary or an `Open question:`. `red` removes the leftover mark. `limit` writes each string in `details.quantities` into the performance criterion, in the human's words. If that line is `out:`, replace it with a criterion that contains the quantity. Do not invent a different number. Do not add a capability the sources do not have. Do not edit a criterion so a quality, check, start place, or kept-item list will look settled. Those judgments belong to the requirements review, and a gap there returns to grill.

Put each unsettled point under `## Boundary` as one `Open question:`. Do not invent an acceptance criterion. Transcribe Background only when the brief already has the human's words.

Write `## Quality`, `## Checks`, and `## Screens` as `rules/quality.md` says. Write a criterion only for an answer the sources give. Do not pick a result yourself. Do not edit a criterion or a screen line so a screen check will pass. A missing arrival, item list, destination, or failure place is a grill question. A result that can still be satisfied by two outcomes a user would see as different, or that builds a place or an action brief `## Scope` In does not contain, stays an `Open question:`. Do not invent a name the result does not force.

A bad requirement replaces behavior with components, APIs, or a widget tree, adds a purpose the sources do not contain, or fills a user-story template the sources did not state. The lines of a new screen are requirements. A list of buttons, layout, or component names is not. A widget word the human's choice uses in a result stays in that line.
