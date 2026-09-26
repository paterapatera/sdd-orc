# Requirements grill

If `requirements.md` is missing or only a heading stub, return `GRILL: BLOCKED`. Do not create a design file.

A BLOCKER is a hole the next phase would have to guess. A sentence that contradicts the brief is a BLOCKER. Quote every `Open question:` as a BLOCKER. Delete that line when its answer is transcribed. If the human takes it home, replace it with `Req grill pending:`. When `details.design_review` is set, each `requirements gap` in that review's Findings is a BLOCKER.

Do not ask:

- Personas, technical bars, or product-wide exclusions that steering already states. Ask only whether this requirement is an exception or the existing decision.
- EARS wording when the criterion is already observable.
- Implementation, APIs, or components. The place a user starts an action is not one of these. Ask it.

Do ask:

- The same thing named differently in the requirements, the brief, and steering. Ask for the mapping. Do not pick a winner.
- A result that can still be satisfied by two outcomes a user would see as different, or that builds a place or an action brief `## Scope` In does not contain. Ask every such branch in the same call, not one per turn. Do not invent a name the result does not force. A widget is a visible form of a result the sentence already states. When more than one widget still satisfies that sentence, offer those widgets, and put the recommended one first. The chosen widget is transcribed into that result. Options are the user-visible outcomes, or 「すでにあり、この機能はそれを使う」, 「この仕様で作る」, 「別の仕様で先に作る」, and 「持ち帰る」. Do not offer a status code or a storage choice. Already there: keep the result, and do not add that place to Scope In. This spec: append the place the human named to Scope In and transcribe it. Another spec: do not add it to Scope In. Add `out:` and a `## Split` line, as Scope growth says for a moved action. The result in this feature may still name that place.
- A `## Quality`, `## Checks`, or `## Screens` line that `.agents/skills/sdd-spec-requirements/rules/quality.md` says is unsettled. Ask those in the same call. Do not repeat that file's examples as a second list.

Options are results a user sees, not status codes or mechanisms. A widget offered for a visible form is one of those results. When the human answers that a Quality, Checks, or Screens characteristic has no condition, write `out: <their words> (source: grill:<id>)` on that characteristic's line. That is not a `## Boundary` line.

Transcribe answers into `## Boundary`, the cited `**Purpose:**`, or the numbered EARS line. When an answer adds an acceptance criterion, write one EARS line from the human's words. Do not emit a pattern the answer did not state. Do not name a screen, a start place, or a destination the chosen label does not already contain. Do not turn 「見える場所」 or 「適切な画面」 into a named place. Leave that sentence out and ask which named place. Including an action, such as 編集 or 削除, does not name the screen it starts from or the screen it opens. Do not renumber unrelated requirements.

You decide `READY`. `sdd.py` does not judge whether a screen, an opener, or a destination is settled. When both `AI round` and `Human round` are 10 or more, it stops instead of opening another round.

Do not transcribe an answer that leaves two criteria both applicable to one event with results that cannot both be true. Ask one follow-up whose options name the disjoint situations, then rewrite both conditions. Each bullet under `### Accepted residual risks` in a requirements or design review is a BLOCKER. When the human includes the behavior, write a numbered criterion. Write a `## Boundary` `out:` only when their words exclude it from this feature, the same kind of statement as the brief's Scope Out. A type, a range, a storage choice, or a design-review decision is not that exclusion. Do not give it `source: design-review`. When `details.boundary_out` is set, delete those lines and ask. The options are 「この機能の対象外」, 「受け入れ条件にする」, and 「持ち帰る」.

## Scope growth

An option expands scope when it adds a user action that the brief's `## Scope` In does not contain. A split candidate is an expansion where both hold:

- The brief's Desired Outcome is still observable and complete without the added action.
- The added action's criteria can be accepted on their own.

When an option would create a split candidate, the same question also offers 「<kept> はこの spec、<added> は別 spec `<new-feature>`」. When an expansion was chosen earlier without that option and it is a split candidate, open one item `split-<new-feature>` with 「この spec に含める」, 「別 spec `<new-feature>` に分ける」, and 「持ち帰る」. The new feature name is a short concept that does not exist under `docs/specs/`.

The answerer marks an expanding choice with `[expands]` in `## Human choices`.

- Kept in this spec: transcribe it, and append the chosen label to the brief's `## Scope` In in the human's words.
- Moved to another spec: do not transcribe the moved action. Remove criteria that only serve it. Add `out: <moved action>（別 spec <new-feature>）` to `## Boundary`. Add one line under `## Split` in `req-grill.md`: `- <new-feature>: <moved action in the human's words> / Dependencies: <feature>`.
