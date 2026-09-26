# Quality coverage

`requirements.md` ends with a `## Quality` section. It has exactly these six lines, in this order:

```markdown
## Quality

- functional:
- reliability:
- usability:
- performance:
- maintainability:
- security:
```

Each value is one or more parts separated by `; `:

- `criteria: <req>.<n>, <req>.<n>` — criteria in this file that settle the characteristic. `<req>` is the `## <req>.` heading number and `<n>` is the numbered line under it.
- `out: <reason> (source: brief)`, `(source: grill:<id>)`, or `(source: steering/<file>)` — the characteristic has no condition here, and the brief, a grill choice, or steering says so.
- `Open question: <what a human must decide>`.

Never write `out:` on your own judgment. Without a source it is an `Open question:`. The requirements review judges whether the cited result fails the bad implementation. A criterion id, by itself, does not.

## What to derive

Read the feature's elements: its actors and excluded actors, the things it keeps, the actions that change them, the values users type, the outside systems it calls, and when or how often it runs. A question the sources answer becomes a criterion. A question they do not answer becomes an `Open question:` on that characteristic's line. Options offered to a human are results a user sees, never status codes or mechanisms. Do not invent numbers.

## When a criterion does not settle the question

Citing the criterion anyway leaves the question open. Write `Open question:` instead.

A result that can still be satisfied by two outcomes a user would see as different, or that builds a place or an action brief `## Scope` In does not contain, is open. Write `Open question:` in the result's own words. Do not invent a name the result does not force. Do not add that place to Scope In yourself. A mechanism the user cannot see, such as a status code, a column type, or a session implementation, is not this question. An open list (`など`, `等`, `etc.`, `or similar`) does not settle a kept-item list. Two criteria that can both apply to one event and whose results cannot both be true do not settle either. A limit settles performance only when the criterion text contains that number.

## Checks

`requirements.md` ends with `## Checks`, after `## Quality`. These four lines are the closed set of failures. A failure applies only through an element this feature has: an actor or an excluded actor, a kept item, an action that changes one, or a value the user types. When the element is absent, the line is `out:` with a source. A new wish that the request never contained is not a fifth failure.

```markdown
## Checks

- leakage:
- destruction:
- lockout:
- rewrite:
```

Each value is `criteria: <req>.<n>`, `out: <reason> (source: brief|grill:<id>|steering/<file>)`, or `Open question: <what a human must decide>`. A cited criterion settles the line only when its result makes the bad implementation fail:

| key | bad implementation that must fail |
| --- | --- |
| leakage | An excluded actor sees or changes a kept item. 「本人だけ」 does not fail this. The result has to say the item is not shown, not changed, or not deleted. |
| destruction | A mistake, a rejected value, or a second success stores or removes the wrong thing. A confirmation alone does not fail this. The result has to say what remains, what can be restored, or what is not stored. When the user can remove something, a different line that only says a rejected value is not stored does not settle the removal. The removal's own line has to say whether it can come back. |
| lockout | After a rejection the user cannot continue, or cannot see which value was rejected and why. Returning to a form is not enough. The result has to say the reason is visible or the user can continue. |
| rewrite | A later change cannot keep the identity of a kept item. The result has to say what identifies it, or what still remains after the change. |

The requirements review judges whether the cited result fails that implementation. A word on the line does not. Do not invent the result. The product is not complete until each cited check has been confirmed on the running system.

## Screens

`requirements.md` ends with `## Screens`, after `## Checks`. A screen here is a visible place this feature adds, which steering and the brief do not already name as a place the user sees. An action added to a place the user already sees is not a screen. That action still needs its start place on its own line.

When this feature adds no screen, the section is one sourced line:

```markdown
## Screens

- out: 新しい画面は無い (source: brief)
```

The source is `brief`, `grill:<id>`, or `steering/<file>`. Never write `out:` on your own judgment. Without a source, write `Open question:`.

When it adds a screen, one `### <name>` block per screen. The four lines cite criteria. A sourced `out:` on `from` settles it only when that line names the opener. A criterion settles its line only when its result makes the bad implementation fail:

```markdown
### 登録

- from: criteria: 2.1
- items: criteria: 2.2
- goes: criteria: 2.3
- failure: criteria: 2.4
```

| key | bad implementation that must fail |
| --- | --- |
| from | The user cannot open this screen, because nothing named leads here. The result names the other place, or the other concrete opener such as a link the human named, and the move onto this screen. 「最初にこの画面を開く」 does not name an opener. Another screen's destination line does not settle this line. |
| items | A kept or typed item is missing from the screen, or the list is open. The result names every item the user sees. 「など」 does not fail this. The result does not have to contain the word 項目. |
| goes | An action opens a different place from the one named. The result names the action and the place it opens, including when the user stays. |
| failure | After a rejection the reason is invisible, or the user is on a different place. The result names that the reason is visible and which place the user is on. |

The criteria themselves stay under a numbered requirement. Do not invent the name, the items, or the places. Ask. The recommended option states all five. The other options for the opening place are places already named, and 「持ち帰る」. Do not offer 「最初にこの画面を開く」, and do not invent a link. The grill skill judges whether these lines are settled. `sdd.py` does not send a screen line back to the grill, and it does not rewrite the criterion. A criterion that says 新しい画面, 新規画面, or 新しいページ is a screen even when the section says `out:`.
