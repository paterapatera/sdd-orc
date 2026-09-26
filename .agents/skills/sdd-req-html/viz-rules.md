# Visualization rules

Read this before filling [template.html](template.html). Prefer omission over a diagram that invents edges or behavior.

Strip every `(source: …)` tag from visible text. Keep the sentence it was attached to.

## EARS classification

Keep trigger keywords in English. Classify by the **first** EARS keyword in the AC:

| First keyword | Type | `data-ears` |
| --- | --- | --- |
| `When` | event | `when` |
| `If` | unwanted / error | `if` |
| `While` | state | `while` |
| `Where` | optional feature | `where` |
| `The … shall` (no When/If/While/Where) | ubiquitous | `shall` |

Combined forms (e.g. `While [state], when [event], the [system] shall …`): still classify by the **first** keyword (`While` → `while`). Put the remaining clauses in the matrix **Condition** cell; do not drop them.

Parse one AC into: **condition** (trigger/precondition text), **subject** (`the [system]` name), **response** (after `shall`). If a part cannot be split cleanly, put the full AC in Condition and leave Subject/Response empty — do not guess a system name.

When the document uses only one EARS type, omit the legend and omit the type column from the index and from every matrix. When it uses more than one, the legend lists only those types, the index shows each row's types, and a requirement matrix includes the type column only when that requirement uses more than one type. Summary badges follow the same rule: show them only when the document has more than one type.

## Always emit (if the source section exists)

### Open questions

Collect every `Open question:` under `## Boundary`, `## Quality`, `## Checks`, and `## Screens` (including inside a screen block). One list, one sentence each, in that source order. Omit the section when there are none.

### Scope

Read `## Boundary`. Two cards: lines whose key is `in` / `out` (also `**In**` / `**Out**`). Drop a card whose text is empty. Drop the section if both are empty. Do not invent an adjacent system. A line `Open question:` stays out of the cards.

### Screens

Read `## Screens`. One block per `###` heading. Omit the whole section when there is no `###` heading (including a lone `out:` that says there is no new screen).

Screen names are the `###` headings. On each card, four rows, in this order: `from`, `items`, `goes`, `failure`. Use the sentence after the key. Drop a row whose text is empty.

**Items**

- `criteria:` — one list item per cited AC. The text is that AC's response clause.
- `out:` — if the sentence contains `など`, `等`, `etc.`, or `or similar`, one list item for the whole sentence. Otherwise, if it contains `・`, one list item per `・` segment. Do not split on `、` or `と`. With no `・`, one list item for the whole sentence.

**Failure row**

`criteria:` links each id to `#req-N` and shows that AC's condition and response. `out:` shows the sentence.

### Screen transition

One `flowchart` for the document, inside the screens section, above the cards. This is the only cross-requirement flowchart.

Nodes are the `###` names, plus a place named in a `from` or `goes` sentence that is not itself a `###` name. Split `from` and `goes` on `。` and `;`. One sentence is one edge.

A sentence is navigation only when it uses one of: `開く`, `移る`, `戻る`, `開始する`, `留まる`, `とどまる`, `open`, `move`, `return`, `start`, `stay`, `remain`. `見える`, `示す`, `show`, and `display` are not navigation. Do not draw an edge from a `failure` line.

- `留まる` or `とどまる` (or `stay` / `remain`): edge from that screen to itself.
- `from`: the other place → this screen. The other place is the `###` name in the sentence, or, when none, the noun phrase immediately before `から` or `で` (English: the phrase after `from`).
- `goes`: this screen → the other `###` name in the sentence.

The edge label is that sentence. Do not add words. The same ordered pair and the same navigation verb are one edge; keep the shorter sentence as the label.

### Screen branch table

On a screen card, when `goes` navigation sentences and `failure` outcomes together make **two or more** columns. One column per `goes` navigation sentence, then one column per cited failure AC. A `failure` line that is `out:` prose is one column.

This table is not the limited-entry Y / N table. Cells are words from the source:

| Row | `goes` column | failure column |
| --- | --- | --- |
| `{{LABEL_COL_COND}}` | the clause of that sentence before the destination; if it cannot be separated, the whole sentence | the AC condition, or the `out:` sentence |
| `{{LABEL_COL_DEST}}` | the target node name | the `###` screen named in the AC response; if the response says the user stays, this screen |
| `{{LABEL_COL_RESPONSE}}` | the `goes` sentence | the AC response, or the `out:` sentence |

Column titles are `{{LABEL_PATTERN}}` plus a 1-based index (`パターン1` / `Pattern 1`). Do not use `R1`. Do not fill Y / N / — / ○ here. Omit the table when it would have one column.

### Requirement index

One table. Columns: ID (link to `#req-N`), purpose (the `**Purpose:**` sentence), AC count, and type badges when the document has more than one EARS type. The requirement id is the number on `## <n>`. The column title is `{{LABEL_COL_PURPOSE}}`, not the markdown label.

### Acceptance-criteria matrix (per requirement)

Every requirement with ≥1 AC gets a table:

`#` | subject | condition | type (badge, only when this requirement has more than one type) | response

Type column: `<span class="badge" data-ears="when|if|while|where|shall">{{LABEL_EARS_*}}</span>`.

Visible badge text is everyday language (see the label table below). Do **not** put `When` / `If` / `While` / `Where` / `shall` on the page — those stay in `requirements.md` only. `data-ears` stays English for CSS.

### Coverage

One section for `## Quality` and `## Checks`, when either exists. One table. Each markdown key is a row, in source order, Quality first. The cell is the cited ids as links to `#req-N` (text `1.2`), or the `out:` sentence. An `Open question:` on that line is also listed under open questions; the cell repeats the question sentence.

### Exception catalog (document-level)

Collect every `If` AC across requirements. Table: requirement link (`#req-N`) | AC # | condition | response.

Omit the section if there are zero `If` ACs. Do not add `When` rows here.

### Purpose card (per requirement)

Parse `**Purpose:**`. A legacy `**目的:**` line is the same sentence. Put the whole sentence in the card body. Do not split it into a role, a capability, and a benefit. The card title is `{{LABEL_STORY}}`.

## Emit only when warranted

### Mermaid flowchart (`flowchart`)

Emit **inside that requirement** when **all** of:

- The requirement has **two or more** `When` ACs, **or** one `When` plus at least one `If` that is clearly the failure of that same event
- The ACs can be read as a sequence or branch **without adding** intermediate steps
- No `## Screens` line cites an AC of this requirement

Node labels: shorten AC condition/response; keep meaning. Edges: only order/branch that the AC text supports (`If` as a no/error branch of a `When` is allowed when the trigger matches).

**Do not emit** for a single lonely `When`, for ubiquitous `shall` lists, for a document-level feature flow stitched across requirements, or for a requirement whose ACs are already cited by a screen. Do not emit a second flowchart inside a screen card.

### Mermaid state diagram (`stateDiagram` / `stateDiagram-v2`)

Emit when the requirement has **two or more** `While` ACs, **or** `While` plus `When` that name a state change the AC actually states.

States = named preconditions in `While` clauses. Transitions = only those implied by `When`/`shall` in the **same** requirement.

**Do not emit** a generic happy-path state machine.

### Decision table (limited-entry)

Emit when **all** of:

- Same subject (system name)
- **Two or more distinct conditions** that combine (multiple `If`/`When`/`While` on one requirement, not just a list of unrelated events)
- The combinations compress into Y / N / — without inventing a combination the md never implies

Shape:

- Columns = patterns (`{{LABEL_PATTERN}}` + 1-based index: ja `パターン1`, `パターン2`, … / en `Pattern 1`, `Pattern 2`, …). Never use `R1`, `R2`.
- Upper rows = conditions; cells = `Y` | `N` | `—` wrapped as `<span class="req-dt-y">Y</span>` / `req-dt-n` / `req-dt-na`
- Lower rows = responses/actions; cells = `○` (`<span class="req-dt-mark">○</span>`) when the action fires, or empty. Never use `X`.

`—` = condition does not apply to that rule. Do not fill a cell with Y/N unless the AC supports it.

**Do not emit** when ACs are a flat list of independent events, or when you would need a full combinatorial expansion the md does not describe. Do not build this table from screen lines. The screen branch table is the table for those lines.

## Page-level structure (order)

1. Header (title, link to `requirements.md`, generated timestamp, not-canonical alert)
2. TOC (only sections that are emitted)
3. Introduction, only when the file has prose before `## Boundary`
4. Open questions, when any exist
5. Scope
6. Screens (transition, then one card each)
7. Requirement index
8. Coverage
9. Exception catalog
10. Per requirement: `<details id="req-N">` (closed) → summary (number, title, AC count, type badges only when the document has more than one type) → purpose card → AC matrix → decision table (if any) → mermaid (if any)
11. Footer (source path)

Legend of everyday-language type badges: once, near the index, and only as the type rule above says. No Tabs JS. Never show raw EARS keywords on the page.

## Labels

Headings and column titles use these strings. `spec.json` `language` `ja` uses the ja column; otherwise en.

| Token | ja | en |
| --- | --- | --- |
| `{{LABEL_OPEN}}` | 未決 | Open questions |
| `{{LABEL_SCREENS}}` | 画面 | Screens |
| `{{LABEL_TRANSITIONS}}` | 画面遷移 | Screen flow |
| `{{LABEL_FROM}}` | 開き方 | Opens from |
| `{{LABEL_ITEMS}}` | 項目 | Items |
| `{{LABEL_GOES}}` | 遷移先 | Goes to |
| `{{LABEL_FAILURE}}` | 失敗時 | On failure |
| `{{LABEL_BRANCH}}` | 分岐 | Branches |
| `{{LABEL_COL_DEST}}` | 行き先 | Place |
| `{{LABEL_COVERAGE}}` | 品質と確認 | Quality and checks |
| `{{LABEL_COL_BASIS}}` | 根拠 | Basis |
| `{{LABEL_EARS_WHEN}}` | イベント | Event |
| `{{LABEL_EARS_IF}}` | 例外 | Exception |
| `{{LABEL_EARS_WHILE}}` | 状態 | State |
| `{{LABEL_EARS_WHERE}}` | 任意機能 | Optional |
| `{{LABEL_EARS_SHALL}}` | 常時 | Always |
| `{{LABEL_EARS_WHEN_HINT}}` | ある出来事が起きたとき | When something happens |
| `{{LABEL_EARS_IF_HINT}}` | 望ましくない条件やエラー | An unwanted condition or error |
| `{{LABEL_EARS_WHILE_HINT}}` | ある状態が続いている間 | While a state holds |
| `{{LABEL_EARS_WHERE_HINT}}` | オプションの機能がある場合 | Where an optional feature is present |
| `{{LABEL_EARS_SHALL_HINT}}` | 条件なしで常に成立 | Always, with no condition |

Quality and Checks row names stay the English keys from the markdown (`functional`, `leakage`, and the rest).

## Forbidden

- Inventing actors, systems, branches, screens, items, or requirements
- Sequence diagrams, pie/bar charts, heatmaps, term clouds, network graphs
- Any graph/chart CDN other than Mermaid
- Mermaid types other than `flowchart` and `stateDiagram` / `stateDiagram-v2`
- A cross-requirement flowchart other than the one screen transition
- A flowchart inside a screen card
- Splitting an items sentence on `、` or `と`
- Empty sections with placeholder lorem or “TBD” diagrams
- Changing `requirements.md`

## Stub documents

If the md has no numbered EARS ACs (init stub): emit header, intro, open questions when any exist, the not-canonical alert, and `recipe:stub`. Skip index, matrix, diagrams, screens, coverage, catalog, and the `#index` shell section.
