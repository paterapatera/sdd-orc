# Requirements grill

If `requirements.md` is missing or only a heading stub, return `GRILL: BLOCKED`. Do not create a design file.

A BLOCKER is a hole the next phase would have to guess. A sentence that contradicts the brief is a BLOCKER. Quote every `Open question:` as a BLOCKER. Delete that line when its answer is transcribed. If the human takes it home, replace it with `Req grill pending:`. When `details.design_review` is set, each `requirements gap` in that review's Findings is a BLOCKER.

Do not ask:

- Personas, technical bars, or product-wide exclusions that steering already states. Ask only whether this requirement is an exception or the existing decision.
- EARS wording when the criterion is already observable.
- Implementation, APIs, components, or visual styling. The place a user starts an action is not styling. Ask it.

Do ask:

- The same thing named differently in the requirements, the brief, and steering. Ask for the mapping. Do not pick a winner.
- Who observes what, when the sources do not settle completion.
- What happens to the previous state after success, when that is unstated.
- Every question `.agents/skills/sdd-spec-requirements/rules/quality.md` derives from this feature's elements that `## Quality`, `## Checks`, or `## Screens` does not settle, even when no `Open question:` names it. A check is not settled by a criterion that would not fail the bad implementation named in that file. A place on a different line does not settle where an action starts. A line that only says a rejected value is not stored does not settle whether a removal can come back. A number that is not in the criterion text does not settle a limit. A new screen is a place this feature adds that the user does not already see. Ask once. The recommended option states the screen name, the place that opens it, every item on it, where each action opens, and which place shows the failure reason. The other options for the opening place are places already named. The last option is 「持ち帰る」. Do not offer 「最初にこの画面を開く」. That sentence does not name what opens the screen. Do not invent a link or a mail. Ask again until one choice names the opener. Do not write those lines until the human chooses. Choosing an existing place writes `out:` on `## Screens` and puts that place on the action's own line. A screen another action opens is still unsettled until one choice names the place the user comes from and this screen together. Do not treat that other action's destination as the answer.

Options are results a user sees, not status codes or mechanisms. When the human answers that a Quality, Checks, or Screens characteristic has no condition, write `out: <their words> (source: grill:<id>)` on that characteristic's line. That is not a `## Boundary` line.

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
