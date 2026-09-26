# Visualization rules

Read this before filling [template.html](template.html). Prefer omission over a card that invents a screen, a domain, or a path.

The page answers what these tasks create and what they update. It does not reprint `tasks.md` field by field.

## What to read

`tasks.md` is one json fence. `tasks` is an array. Use `id`, `status`, `title`, `done`, `physical`, `physical_decisions`, `req`, `boundary`, `contracts`, `depends`, and `blocked`. Ignore `wave`.

`requirements.md` is read only for `## Screens` `###` headings. Do not copy items, transitions, or acceptance criteria onto this page.

Do not open a contract file. A `contracts` entry stays a path.

When the file has no json `tasks` array, it is a legacy checkbox list. Emit those checkbox lines in source order under one section, in their own words. Do not group them. The rest of this file does not apply.

### Domain name

A domain is the filename stem of a task's `contracts` entry before the first hyphen. `docs/contracts/billing-api.md` is the domain `billing`. Collect stems from the tasks in source order, then from each task's `contracts` in that order. Do not invent a domain from a folder or from `boundary`.

## Groups

Emit one card per group that has at least one task. Order:

1. Screens, in `## Screens` order.
2. Domains, in the order their stems first appear.
3. `{{LABEL_OTHER}}`, when anything remains.

Omit a group that would be empty. Omit the whole changes section when there are no tasks.

### Where a task goes

A task's text is `title`, `done`, `physical`, each `boundary` entry, and each `contracts` entry, in that order.

A screen heading matches when that `###` string appears in the text. Try the longest heading first. A shorter heading counts only where it still appears outside a longer heading's span. Text that only contains `記録詳細` matches `記録詳細`, not `記録`, when both are `###` headings. Text that names both, in separate spans, matches both.

- When one or more screens match, the task is in each of those screen cards. It is not also in a domain card.
- Otherwise, when the text or a `boundary` entry contains a domain stem as its own slash-separated segment, or a `contracts` entry's own stem is that domain, the task is in that one domain card. When more than one stem matches, use the stem that starts earliest in the path, then the longer stem.
- Otherwise the task is in `{{LABEL_OTHER}}`.

Inside a group, tasks stay in source order.

## Always emit (if the source is non-empty)

### Blocked

When any task has `blocked` set, one alert before the groups. One line per such task, in source order: the id and the `blocked` sentence. Omit when every `blocked` is null.

### Changes

One section. It starts with `{{LABEL_CHANGES_LEAD}}`. Each group starts with a badge `{{LABEL_SCREEN}}`, `{{LABEL_DOMAIN}}`, or no badge for `{{LABEL_OTHER}}`, then the screen heading or the domain stem. The other card's title is `{{LABEL_OTHER}}`.

One block per task. The heading is the id and `title`. Show `status` with these glosses. Do not show the raw value.

| `status` | ja | en |
| --- | --- | --- |
| `open` | 未着手 | Open |
| `done` | 完了 | Done |

Any other `status` is shown as written.

**Create** (`{{LABEL_CREATE}}`)

A `boundary` entry that contains a `/` and is not a file in the repository. Show the path. Drop the list when none.

**Update** (`{{LABEL_UPDATE}}`)

A `boundary` entry that contains a `/` and is a file in the repository. Show the path. Drop the list when none.

A `boundary` entry with no `/` is not a file. One line under the lists: the entry as written. Do not call it create or update.

Then, in this order, omit a row whose text is empty:

- `done`
- `physical`
- each `physical_decisions` entry: `id`, `choose`, and `rejected` when it is not null. Show `basis` with the glosses below. Do not show the raw key.

| `basis` | ja | en |
| --- | --- | --- |
| `requirements` | 要求が決めている | The requirements decide |
| `human` | 人が選んだ | A person chose |
| `recommendation` | 推奨 | Recommendation |

- `req`: the ids only
- `depends`: the ids only, with `{{LABEL_DEPENDS}}`
- `contracts`: each path

## Page order

1. Header (title, link to `tasks.md`, generated timestamp, not-canonical alert)
2. Blocked
3. Changes (screen cards, domain cards, then the other card)
4. Footer (source path)

Omit a step whose source is empty. TOC lists each emitted group. No `wave` in the TOC.

## Coverage gap

When `requirements.md` exists, collect numeric requirement ids from headings such as `## 1`. An id is covered when it appears in some task's `req`. List uncovered ids. Omit the alert when every id is covered or the requirements file is missing. Omit the alert for a legacy checkbox file.

## Labels

`spec.json` `language` `ja` uses the ja column; otherwise en.

| Token | ja | en |
| --- | --- | --- |
| `{{LABEL_CHANGES}}` | 作成と更新 | Creates and updates |
| `{{LABEL_CHANGES_LEAD}}` | 画面ごと、またはドメインごとに、この作業が作るものと更新するものを見ます。 | See what this work creates and what it updates, by screen or by domain. |
| `{{LABEL_SCREEN}}` | 画面 | Screen |
| `{{LABEL_DOMAIN}}` | ドメイン | Domain |
| `{{LABEL_OTHER}}` | 画面にもドメインにも属さない | Not a screen or a domain |
| `{{LABEL_CREATE}}` | 作成 | Create |
| `{{LABEL_UPDATE}}` | 更新 | Update |
| `{{LABEL_DEPENDS}}` | 先に終える作業 | Finish first |
| `{{LABEL_BLOCKED}}` | 着手できない | Cannot start |
| `{{LABEL_DONE}}` | 確認すること | Check |
| `{{LABEL_PHYSICAL}}` | 形 | Shape |

## Forbidden

- One table of every task with no screen or domain
- Inventing paths, requirement ids, screen names, or domain names
- A domain taken from a directory or from a `boundary` entry that matches no contract stem
- Opening a contract file, or reading the contracts directory
- Reading `requirements.md` beyond `## Screens` headings
- Re-rendering EARS matrices or screen item tables
- Showing `wave`
- Empty sections
- Changing `tasks.md` or any other spec file

## Stub documents

Treat as stub when the `tasks` array is missing or empty, and the file is not a legacy checkbox list. Emit the header, the not-canonical alert, and `recipe:stub`.
