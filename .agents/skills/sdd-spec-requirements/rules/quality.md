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

Never write `out:` on your own judgment. Without a source it is an `Open question:`. The requirements review judges whether the line cites a criterion that exists, or a sourced `out:`. A criterion id that is not in this file does not. Do not invent a scene for the name.

## What to derive

The six names stay abstract words. Do not expand one into a scene: a second save, what remains, a visible reason, who can see an item, or an identity. A name is settled by citing criteria the sources already support, or by `out:` when a source says that name has no condition. An `Open question:` names only a behavior the brief or steering already states. Do not invent numbers.

## EARS coverage

Coverage is the patterns in `.agents/skills/sdd-spec-requirements/rules/ears-format.md`. A behavior the brief or steering already shows uses the keyword for that situation. An unwanted result is `If`. A continuing state is `While`. A response to something that happens is `When`. An optional feature is `Where`. A behavior with no trigger is a bare `shall`. Do not emit a pattern the sources do not contain. The brief does not have to use the English keyword. When that kind is already in the sources and no numbered line uses its keyword, that is the open point. Ask which of those patterns applies. Do not invent the scene or the response in order to fill a kind.

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

Each value is `criteria: <req>.<n>`, `out: <reason> (source: brief|grill:<id>|steering/<file>)`, or `Open question: <what a human must decide>`. These four names stay abstract, the same way as `## Quality`. A cited criterion settles the line when that criterion exists in this file. Do not expand a name into a scene, and do not invent the result. The product is not complete until each cited check has been confirmed on the running system.

## Screens

`requirements.md` ends with `## Screens`, after `## Checks`. A screen here is a visible place whose arrival onto it, items shown there, navigation from there, or failures shown there this feature's acceptance criteria describe. That includes a place steering or the brief already name, and a place this feature newly introduces. Write one `### <name>` block per such place. The heading is the place name without a trailing `画面` when the criteria use the `○○画面` form. An action still needs its start place on its own criterion line.

When no criterion describes any such place for this feature, the section is one sourced line:

```markdown
## Screens

- out: 新しい画面は無い (source: brief)
```

The source is `brief`, `grill:<id>`, or `steering/<file>`. Never write `out:` on your own judgment. Without a source, write `Open question:`.

When it describes at least one such place, one `### <name>` block per place. The five lines cite criteria, except `sort` on a non-list screen. A sourced `out:` on `from` settles it only when that line names the opener. A criterion settles its line only when its result makes the bad implementation fail:

```markdown
### 登録

- from: criteria: 2.1
- items: criteria: 2.2
- sort: out: 並び順の条件は無い (source: brief)
- goes: criteria: 2.3
- failure: criteria: 2.4
```

```markdown
### 感想一覧

- from: criteria: 1.1
- items: criteria: 1.1
- sort: criteria: 1.2
- goes: criteria: 1.3
- failure: criteria: 1.4
```

| key | bad implementation that must fail |
| --- | --- |
| from | The user cannot open this screen, because nothing named leads here. The result names the other place, or the other concrete opener such as a link the human named, and the move onto this screen. 「最初にこの画面を開く」 does not name an opener. Another screen's destination line does not settle this line. |
| items | A kept or typed item is missing, the list is open, or a typed item does not name its control. Each item the user types or chooses names one control: `テキスト入力`, `テキストエリア`, `セレクトボックス`, `ラジオボタン`, or `チェックボックス`. `入力` does not name one. A value only shown names `表示`. A pressable control names `ボタン`. 「など」 does not fail this. The result does not have to contain the word 項目. Ask one item's control. The sentence is concrete enough to mark that control up in HTML. |
| sort | A **list screen** shows rows in the wrong order, or the order rule is missing. A list screen is a `###` name ending in `一覧` or `リスト`, or an `items` line whose cited criteria name a list (`一覧`, `リスト`, `各…`, `複数件`, `行ごと`). On a list screen, the result names the **sort key** (for example `記録日`, `タイトル`, `更新日`) and the **order** (`新しい順`, `古い順`, `昇順`, `降順`, or another rule the human chose). `適切な順` does not settle it. On a non-list screen, `out:` with a source settles it. |
| goes | An action navigates to a different screen from the one named. The result names the action and the `遷移先の画面`, including when the displayed screen does not change (`同じ画面のまま`). |
| failure | Several failures are one `拒否`. `バリデーションエラー`, `404エラー`, `権限エラー`, and `サーバーエラー` are different. Each class this screen can show is its own criterion. One class is settled only when that criterion names the class, the `表示している画面`, where on that screen the reason is shown, and the form: `項目直下のインラインテキスト`, `画面上部のアラート`, or `ダイアログ`. `理由が見える` does not settle it. A class this screen cannot show is `out:` with a source. Ask the class, the `表示している画面`, where the reason is shown, and the form as separate questions. Do not merge the four classes into `拒否`. Do not join two of those decisions in one prompt. |

The criteria themselves stay under a numbered requirement. Do not invent the name, the items, or the places. Ask. The recommended option states all five. The other options for the opening place are places already named, and 「持ち帰る」. Do not offer 「最初にこの画面を開く」, and do not invent a link. The grill skill judges whether these lines are settled. `sdd.py` does not send a screen line back to the grill, and it does not rewrite the criterion. A criterion that says 新しい画面, 新規画面, or 新しいページ is a screen even when the section says `out:`.
