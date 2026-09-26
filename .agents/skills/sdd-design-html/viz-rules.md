# Visualization rules

Read this before filling [template.html](template.html). Prefer omission over a card that invents a screen, a domain, or a change.

The page answers what this design creates and what it updates. It does not reprint `design.md` section by section. Do not put layer badges (`external` / `internal` / `physical`) on the page. The Record has no such slot.

## What to read

`design.md` has `## Overview`, a `## Record` json fence, and headings only for ids that exist in that fence.

`requirements.md` is read only for `## Screens` `###` headings. Do not copy items, transitions, or acceptance criteria onto this page.

| Slot | Source |
| --- | --- |
| Overview | `## Overview` prose |
| Current | `Record.current` when it is an object |
| Screen name | a `###` heading under `requirements.md` `## Screens` |
| Domain name | the stem of `Record.contracts[].path`, below |
| Create / update | `Record.files`, component headings, `Record.contracts` |
| Decisions | `## Decisions` / `### D-<name>`, matched to `Record.decisions[]` by `id`, inside the group that names them |
| Failures | `## Failures` / `### <req id>`, matched to `Record.failures[].req`, inside the group that names them |
| Components | `#### <Name> {#D-<Name>}`, matched to `Record.components[].id`, inside the group that names them |
| Contracts | `Record.contracts`, and the file at each path, inside the group that names them |
| ADR | an ADR file named by a review surface (below), inside that same group |

Ignore a heading that is not in this table. Do not look for Goals, Architecture, Technology Stack, Persistent References, Data Models, Observability, Testing Strategy, or Operational Readiness. If one of those headings is present in an older file, omit it.

Do not emit a top-level Boundary, Decisions, Failures, Components, Contracts, ADR, Directions, or Files section. `docs/architecture/boundaries.md` is not a section of this page.

Open a contract or ADR file only when a review surface names it. Do not read the contracts directory or `docs/architecture/adr/` in bulk.

### Review surface

The customer reviews a file when the design asks them to judge it.

- A contract with `mode` `modify` is a review surface. Read that file.
- A contract with `mode` `reference` is not. Show the path and the mode gloss only.
- An ADR is a review surface when a decision with `reversible` `false` contains its `ADR-NNNN` id, or when a `modify` contract's Related ADR points at it. Read that file. Any other ADR mention is a path only, with no body.

### Domain name

A domain is the filename stem of a `Record.contracts[].path` before the first hyphen. `docs/contracts/billing-api.md` is the domain `billing`. Collect stems from the Record only, in the order the contracts appear. Do not invent a domain from a folder, a component name, or `owns`.

## Groups

Emit one card per group that has at least one create row, update row, reference line, decision, or failure. Order:

1. Screens, in `## Screens` order.
2. Domains, in the order their stems first appear in `Record.contracts`.
3. `{{LABEL_OTHER}}`, when anything remains.

Omit a group that would be empty. Omit the whole changes section when every group is empty.

### Where an item goes

An item's text is:

| Item | Text |
| --- | --- |
| file | `change` |
| component | the responsibility sentence |
| contract | its `path` |
| decision | the because sentence, then `choose` |
| failure | the failure sentence |

A screen heading matches when that `###` string appears in the text. Try the longest heading first. A shorter heading counts only where it still appears outside a longer heading's span. Text that only contains `記録詳細` matches `記録詳細`, not `記録`, when both are `###` headings. Text that names both, in separate spans, matches both.

- When one or more screens match, the item is in each of those screen cards. It is not also in a domain card.
- Otherwise, when the text or a file `path` contains a domain stem as its own slash-separated segment, or the contract's own stem is that domain, the item is in that one domain card. When more than one stem matches, use the stem that starts earliest in the path, then the longer stem.
- Otherwise the item is in `{{LABEL_OTHER}}`.

Do not assign `owns`, `must_not`, or `depends` to a card.

## Always emit (if the source is non-empty)

### Overview

The Overview paragraphs. Drop empty placeholders.

### Current

One card when `current.constraint` is a non-empty string. Show `evidence` as a path. Omit when `current` is null or absent. This card is not a group.

### Changes

One section. It starts with `{{LABEL_CHANGES_LEAD}}`. Each group card starts with a badge `{{LABEL_SCREEN}}`, `{{LABEL_DOMAIN}}`, or no badge for `{{LABEL_OTHER}}`, then the screen heading or the domain stem. The other card's title is `{{LABEL_OTHER}}`.

Inside a card, two lists. Drop a list that has no row.

**Create** (`{{LABEL_CREATE}}`)

- A `files[]` row whose `path` is non-empty and is not a file in the repository. Show the path and `change`.
- A component that belongs to this group. Show the name, the responsibility sentence, `reqs`, and `io`. Link the name to `#D-Name`. `io` stays in the row. Do not draw a flowchart.

**Update** (`{{LABEL_UPDATE}}`)

- A `files[]` row whose `path` is non-empty and is a file in the repository. Show the path and `change`.
- A `modify` contract that belongs to this group. A card with the file's title, Purpose, mode gloss `{{LABEL_MODE_MODIFY}}`, the Related ADR as a link, the `## Contract` table or the paragraphs directly under that heading, and `## Non-goals`. Keep a link to the file. When the file is missing, the path and `{{LABEL_FILE_MISSING}}` only.

A `reference` contract is neither create nor update. One line on its group: the path and `{{LABEL_MODE_REF}}`. Do not open the file.

After the lists, decisions and failures that belong to this group. They are not their own page sections.

One block per decision: the heading's sentence, `choose`, and `rejected` from the matching object. Omit `rejected` when null. Show `reversible` and `basis` with these glosses. Do not show the raw keys.

| Field | Value | ja | en |
| --- | --- | --- | --- |
| reversible | false | 覆しにくい（確認する） | Hard to reverse (confirm) |
| reversible | true | 後から変えられる | Can change later |
| basis | requirements | 要求が決めている | The requirements decide |
| basis | human | 人が選んだ | A person chose |
| basis | recommendation | 推奨 | Recommendation |

One line per failure: the requirement id and the sentence.

### ADR

Inside the decision or `modify` contract that names it. One card per review-surface ADR: Status, the `## Decision` paragraphs, `## Alternatives considered`, and a link to the file. An ADR that is only a path is one line: the path. Resolve `ADR-NNNN` to `docs/architecture/adr/ADR-NNNN-*.md`. When the file is missing, the id and `{{LABEL_FILE_MISSING}}` only.

## Diagrams

Copy a fenced `mermaid` when it already sits under a decision or failure that this page shows. Allowed types: `flowchart` / `graph`, `sequenceDiagram`, `stateDiagram` / `stateDiagram-v2`, `erDiagram`. Skip any other type. Put it in that group's card.

Do not add a diagram. Do not draw a boundary flowchart, a component flowchart, or a file flowchart.

## Page order

1. Header (title, link to `design.md`, generated timestamp, not-canonical alert)
2. Overview
3. Current
4. Changes (screen cards, domain cards, then the other card)
5. Footer (source path)

Omit a step whose source is empty. TOC lists Overview, Current when emitted, and each emitted group. No layer badge in the TOC.

## Coverage gap

When `requirements.md` exists, collect numeric requirement ids from headings such as `## 1`. An id is covered when it appears in `design.md`. List uncovered ids. Omit the alert when every id is covered or the requirements file is missing.

## Labels

`spec.json` `language` `ja` uses the ja column; otherwise en.

| Token | ja | en |
| --- | --- | --- |
| `{{LABEL_CHANGES}}` | 作成と更新 | Creates and updates |
| `{{LABEL_CHANGES_LEAD}}` | 画面ごと、またはドメインごとに、この設計が作るものと更新するものを見ます。 | See what this design creates and what it updates, by screen or by domain. |
| `{{LABEL_SCREEN}}` | 画面 | Screen |
| `{{LABEL_DOMAIN}}` | ドメイン | Domain |
| `{{LABEL_OTHER}}` | 画面にもドメインにも属さない | Not a screen or a domain |
| `{{LABEL_CREATE}}` | 作成 | Create |
| `{{LABEL_UPDATE}}` | 更新 | Update |
| `{{LABEL_MODE_MODIFY}}` | この設計で更新する | Updated by this design |
| `{{LABEL_MODE_REF}}` | 参照する | Reference |
| `{{LABEL_FILE_MISSING}}` | ファイルが無い | File is missing |

## Forbidden

- A top-level section per design heading (Boundary, Decisions, Failures, Components, Contracts, ADR, Directions, Files)
- Inventing components, actors, edges, requirement ids, contract paths, screen names, or domain names
- A domain taken from a directory, a component name, or `owns`
- An edge that makes `owns`, `depends`, or a component `io` look like a processing step
- Reading a contract or ADR directory in bulk
- Reading `requirements.md` beyond `## Screens` headings
- Re-rendering EARS matrices or screen item tables from `requirements.md`
- Mermaid types other than `flowchart` / `graph`, `sequenceDiagram`, `stateDiagram` / `stateDiagram-v2`, and `erDiagram`
- Empty sections and placeholder diagrams
- Changing `design.md` or any contract, ADR, or boundaries file

## Stub documents

Treat as stub when Overview is empty and `Record` has no non-empty `files`, `decisions`, `failures`, or `components`. Emit the header, the not-canonical alert, and `recipe:stub`.
