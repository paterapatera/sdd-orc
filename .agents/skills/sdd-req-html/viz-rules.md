# Visualization rules

This file is the **only** rule set for the requirements HTML preview. [SKILL.md](SKILL.md), [recipes.md](recipes.md), and [template.html](template.html) do not add rules.

## Output

Write one static HTML file next to `docs/specs/<feature>/requirements.md`. Do not change `requirements.md`, `spec.json`, `req-grill.md`, or any other spec file while building the preview.

## Assets

- Shell: [template.html](template.html). Slot markup: [recipes.md](recipes.md). Paste [theme.css](theme.css) into `{{THEME_CSS}}`; do not treat CSS as rules.
- Map each `{{SLOT_*}}` to the matching `recipe:*` in recipes.md (`{{SLOT_TOC}}` → `recipe:toc`, `{{SLOT_OPEN}}` → `recipe:open`, `{{SLOT_SCOPE}}` → `recipe:scope`, `{{SLOT_SCREENS}}` → `recipe:screens`, `{{SLOT_LEGEND}}` / `{{SLOT_INDEX}}` → `recipe:legend` / `recipe:index-table`, `{{SLOT_EXCEPTIONS}}` → `recipe:exceptions`, `{{SLOT_REQUIREMENTS}}` → one `recipe:requirement` per requirement plus optional `recipe:decision-table`, `recipe:mermaid-flow`, `recipe:mermaid-state` inside that block, `{{SLOT_COVERAGE}}` → `recipe:coverage`, `{{SLOT_GRILL_LEFT}}` → `recipe:grill-left`). Stub: `recipe:stub` after `#intro` when **Stub** applies; drop the `#index` section from the shell.

Read this file before filling the template. Prefer omission over a diagram that invents edges or behavior.

Strip `(source: …)` from visible text; keep the sentence.

## Grill answers

Read `req-grill.md` `## Human choices` when that file exists. Each choice is one answer. The answer is the text after the colon on the choice line. Ignore `[expands]` before that colon. The question is the indented `質問:` line under it. Skip a choice with no answer. Skip `## DEFERRED` and `## AI Answers`.

Mark the smallest visible piece that states the choice's decision (rewording ok): a list item, an item-row `req-item-kind`, an AC-matrix cell, or a response clause. Count controls, failure forms, item kinds, and `(source: grill:<id>)`. Not screen-name-only overlap unless that piece is what the question asked; not Mermaid labels; not the screen branch table `{{LABEL_KIND}}` column (plain text only). Not a whole requirement for one clause. Several choices on one piece → one wrap.

The wrap is a `span.req-grill` around the visible phrase only. Do not emit `span.req-grill-tip`, `role="tooltip"`, or any hover or focus popup. The mark is background highlight only (`theme.css`). Do not put question or answer text inside the wrap. Copy Q&A only into `#grill-left` for choices that were not marked. Do not invent a mark when the piece does not state that decision.

After the coverage section and before the footer, one section `id="grill-left"` for every Human choice that was not marked. The heading is `{{LABEL_GRILL_LEFT}}`. One list, source order. Each item is the question, then the answer. Copy both from `req-grill.md`. Omit the section when every choice was marked, or when `## Human choices` is empty.

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

Screen names are the `###` headings. On each card, `from` is the first row. Then the item table. Then notices, if any. Then the branch table when it has two or more rows. `goes` and `failure` are rows only when the branch table is omitted. Drop a row whose text is empty.

**Items**

One list. Each leaf is a noun from the items line, plus `{{LABEL_KIND}}`. Not an acceptance sentence. Do not add a column that says whether the item repeats.

Take the `out:` sentence, or the response clause of each cited AC. Split on `。`.

A sentence is a notice, not an item, when it says that a reason or a success is visible (`成功したこと`, `理由`, `未入力であること`) and it does not list fields with `・` or `と`. Put each notice under `{{LABEL_NOTICE}}`, after the list, in the sentence's own words. If the branch table's response cell already contains that sentence, omit the notice.

Any other sentence is an item sentence:

1. Remove a trailing `が見える` or `を見せる` only.
2. If it contains `など`, `等`, `etc.`, or `or similar`, one row. The name is the sentence after step 1. Do not split it.
3. Otherwise separate fields from operations. If the sentence contains `と、`, the left side is fields and the right side is operations. Else if a `と` is followed by a part that contains `操作`, split at that `と`.
4. Fields: split on `・`. If the side has no `・` but has `と` (`本のタイトルと記録日`, or `書籍名のテキスト入力と感想のテキストエリア`), split on `と`. A piece that contains `テキスト入力`, `テキストエリア`, `セレクトボックス`, `ラジオボタン`, `チェックボックス`, or `ボタン` keeps that control. Strip a trailing `を見せる` or `が見える` from the name, and do not also mark that piece `表示`. A piece with none of those controls is `表示` when the sentence's verb is `見せる` or `見える`. A piece that only says `の入力` or `の変更` has no kind. Do not mark it `入力`.
5. Operations: if the side ends with `操作`, delete that one trailing `操作`, then split on `・`. Each piece is `操作`. The name is the piece (`記録完了`, `変更完了`, `変更`, `削除`).

A sentence with `各<noun>` (`各感想`) puts those leaves under one group. The group name is the noun without `各` (`感想`). The group's kind is `{{LABEL_MANY}}`.

A container is a wider group and has no kind. It exists only when the source names it.

- The items value is a nested list: keep that tree. A parent written `名前(複数件)` or `名前（複数件）` is a `{{LABEL_MANY}}` group; drop the parentheses from the name. Any other parent is a container.
- The items value is prose: a prefix `<name>では` or `<name>に` opens a container named `<name>`, when `<name>` is not this screen's `###` title. The rest of that sentence, including a `各` group, sits inside it. The same name across sentences is one container.

Leaves with no container and no `各` stay at the top level. Do not invent a container. Do not print a path. `*.エリア1.感想.本のタイトル` only means the container `エリア1`, the group `感想`, and the leaf `本のタイトル`.

`{{LABEL_KIND}}` on the screen card is `span.req-item-kind` for that leaf only (not the branch-table column). The **item name** is the field noun; the **kind** is how the user enters or reads it — the control or surface, not the field label.

Derive the kind from the **response clause of the AC that cites this leaf** (`criteria:` on the screen line, or the sentence that created the leaf). Do not set every leaf to `表示` because the response uses `見せる` or `見える`.

**Standard control kinds** (use when the source names them): `テキスト入力`, `テキストエリア`, `セレクトボックス`, `ラジオボタン`, `チェックボックス`, `ボタン`, `操作`, `表示`. These match the usual single-line / multi-line / choice / action / read-only split you would express with shadcn-style primitives (Input, Textarea, Select, Radio Group, Checkbox, Button); keep the **Japanese label from the requirements or grill**, not English component names.

**Other widgets** the AC or grill names (calendar, date picker, rating control, toggle, slider, combobox, custom icon control, etc.): use the **shortest control phrase** from that source (`カレンダー`, `星アイコン`, …). Do not rename it to `表示` or to a standard kind unless the source uses that word.

`表示` only when the clause describes visible content and names **no** input or interactive control. One cited AC → one leaf → one kind; do not merge several `criteria:` lines into one row or one shared `表示`.

When `req-grill.md` states the control for this item, the kind must match that answer (rewording ok). Prefer `span.req-grill` on `req-item-kind` or the item name — not on the branch-table kind column.

`の入力` / `の変更` without a named control has no kind cell. Do not use `入力` alone. Do not invent `アラート` on items unless the sentence says `アラート`.

**Failure row**

Use this row only when the branch table is omitted. `criteria:` links each id to `#req-N` and shows that AC's condition and response. `out:` shows the sentence. The response keeps the place it names (`記録画面に示し`). Do not add a widget word the sentence does not have.

### Screen transition

One `flowchart` for the document, inside the screens section, above the cards. This is the only cross-requirement flowchart.

Nodes are the `###` names, plus a place named in a `from` or `goes` sentence that is not itself a `###` name. Split `from` and `goes` on `。` and `;`. One sentence is one edge.

A sentence is navigation only when it uses one of: `開く`, `移る`, `戻る`, `開始する`, `留まる`, `とどまる`, `open`, `move`, `return`, `start`, `stay`, `remain`. `見える`, `示す`, `show`, and `display` are not navigation. Do not draw an edge from a `failure` line.

- `留まる` or `とどまる` (or `stay` / `remain`): edge from that screen to itself.
- `from`: the other place → this screen. The other place is the `###` name in the sentence, or, when none, the noun phrase immediately before `から` or `で` (English: the phrase after `from`).
- `goes`: this screen → the other `###` name in the sentence.

The edge label is that sentence without its leading acceptance-criterion number. Do not add words. The same ordered pair and the same navigation verb are one edge; keep the shorter sentence as the label.

### Screen branch table

On a screen card, when `goes` navigation sentences and `failure` outcomes together make **two or more** rows. One row per `goes` navigation sentence, then one row per cited failure AC. A `failure` line that is `out:` prose is one row.

This table is not the limited-entry Y / N table. Patterns run down the first column. Headers are `{{LABEL_PATTERN}}`, `{{LABEL_COL_COND}}`, `{{LABEL_COL_DEST}}`, `{{LABEL_COL_RESPONSE}}`, `{{LABEL_KIND}}`. Cells are words from the source:

| Column | `goes` row | failure row |
| --- | --- | --- |
| `{{LABEL_COL_COND}}` | the clause before the destination; if it cannot be separated, the whole sentence | the AC condition, or the `out:` sentence |
| `{{LABEL_COL_DEST}}` | the target node name | the screen named in `表示している画面` or before `を表示したまま`; otherwise the `###` screen named in the AC response. `表示したまま` is that screen, not a new transition |
| `{{LABEL_COL_RESPONSE}}` | the `goes` sentence | the AC response, or the `out:` sentence |
| `{{LABEL_KIND}}` | `遷移` | the form written in the response: `項目直下のインラインテキスト`, `ダイアログ`, or `画面上部のアラート`. Do not replace one of those with `表示` because the sentence also says `示す` or `見せる`. `遷移` when the row only moves and names none of those forms |

The last column is plain text only. Do not wrap it in `span.req-grill`. Mark the grill choice on the item control or another visible piece that states that decision; otherwise list it under `#grill-left`.

The pattern cell is the 1-based index alone (`1`, `2`). The column header is already `{{LABEL_PATTERN}}`, so the cell does not repeat that word. Do not use `R1`. Do not fill Y / N / — / ○ here. Omit the table when it would have one row. When the table is present, omit the card's `goes` and `failure` rows so those sentences are not shown twice.

### Requirement index

One table. Columns: ID (link to `#req-N`), purpose (the `**Purpose:**` sentence), AC count, and type badges when the document has more than one EARS type. The requirement id is the number on `## <n>`. The column title is `{{LABEL_COL_PURPOSE}}`, not the markdown label.

### Acceptance-criteria matrix (per requirement)

Every requirement with ≥1 AC gets a table:

`#` | subject | condition | type (badge, only when this requirement has more than one type) | response

Type column: `<span class="badge" data-ears="when|if|while|where|shall">{{LABEL_EARS_*}}</span>`.

Visible badge text is everyday language (see the label table below). Do **not** put `When` / `If` / `While` / `Where` / `shall` on the page — those stay in `requirements.md` only. `data-ears` stays English for CSS.

### Coverage

One section for `## Quality` and `## Checks`, when either exists. Place it after every requirement, immediately before the footer. One lead sentence: `{{LABEL_COVERAGE_LEAD}}`. One table. Each markdown key is a row, in source order, Quality first.

The name cell is the Japanese or English gloss below, never the raw key (`functional`, `leakage`). The question cell is the fixed sentence in that same table. The basis cell is the cited AC's response clause, with the id linked to `#req-N` (`1.2` plus the response). An `out:` sentence is the basis when there is no criterion. An `Open question:` on that line is also listed under open questions; the basis cell repeats the question sentence.

| key | ja name | en name | ja question | en question |
| --- | --- | --- | --- | --- |
| functional | 機能 | Function | 機能として書いた振る舞いが、受け入れ条件か出典のある対象外になっているか | Is the behavior named as function a criterion, or a sourced exclusion? |
| reliability | 信頼性 | Reliability | 信頼性として書いた振る舞いが、受け入れ条件か出典のある対象外になっているか | Is the behavior named as reliability a criterion, or a sourced exclusion? |
| usability | 使いやすさ | Usability | 使いやすさとして書いた振る舞いが、受け入れ条件か出典のある対象外になっているか | Is the behavior named as usability a criterion, or a sourced exclusion? |
| performance | 性能 | Performance | 性能として書いた振る舞いが、受け入れ条件か出典のある対象外になっているか | Is the behavior named as performance a criterion, or a sourced exclusion? |
| maintainability | 保守性 | Maintenance | 保守性として書いた振る舞いが、受け入れ条件か出典のある対象外になっているか | Is the behavior named as maintainability a criterion, or a sourced exclusion? |
| security | 安全性 | Safety | 安全性として書いた振る舞いが、受け入れ条件か出典のある対象外になっているか | Is the behavior named as safety a criterion, or a sourced exclusion? |
| leakage | 漏洩 | Leakage | 漏洩として書いた振る舞いが、受け入れ条件か出典のある対象外になっているか | Is the behavior named as leakage a criterion, or a sourced exclusion? |
| destruction | 破損 | Damage | 破損として書いた振る舞いが、受け入れ条件か出典のある対象外になっているか | Is the behavior named as damage a criterion, or a sourced exclusion? |
| lockout | 行き止まり | Dead end | 行き止まりとして書いた振る舞いが、受け入れ条件か出典のある対象外になっているか | Is the behavior named as a dead end a criterion, or a sourced exclusion? |
| rewrite | 同一性 | Identity | 同一性として書いた振る舞いが、受け入れ条件か出典のある対象外になっているか | Is the behavior named as identity a criterion, or a sourced exclusion? |

### Exception catalog (document-level)

Collect every `If` AC across requirements. Table: requirement link (`#req-N`) | AC # | condition | response.

Omit the section if there are zero `If` ACs. Do not add `When` rows here.

### Purpose card (per requirement)

Parse `**Purpose:**`. A legacy `**目的:**` line is the same sentence. Put the whole sentence in the card body. Do not split it into a role, a capability, and a benefit. The card title is `{{LABEL_STORY}}`.

## Emit only when warranted

For each subsection below: when its conditions are met, **must emit** the matching recipe block in the slot **Page-level structure** names. When they are not met, omit it. Treating a met condition as optional is not allowed. Do not skip a required emission to shorten the file.

### Mermaid flowchart (`flowchart`)

Emit **inside that requirement** when **all** of:

- The requirement has **two or more** `When` ACs, **or** one `When` plus at least one `If` that is clearly the failure of that same event
- The ACs can be read as a sequence or branch **without adding** intermediate steps

The screen transition stays the whole journey. This flowchart is the part those ACs support, including when a `## Screens` line cites them. Node labels: shorten AC condition/response; keep meaning. Edges: only order/branch that the AC text supports (`If` as a no/error branch of a `When` is allowed when the trigger matches).

Mermaid 11 reads every node and edge label as Markdown. A label that starts with a number, a period, and a space (`3. When`) is a numbered list, which Mermaid rejects and the diagram does not render. Drop that number. Do not start a label with `#`, `*`, `-`, or `>`.

**Do not emit** for a single lonely `When`, for ubiquitous `shall` lists, or for a document-level feature flow stitched across requirements. Do not emit a second flowchart inside a screen card.

### Mermaid state diagram (`stateDiagram` / `stateDiagram-v2`)

Emit when the requirement has **two or more** `While` ACs, **or** `While` plus `When` that name a state change the AC actually states.

States = named preconditions in `While` clauses. Transitions = every `When` or `shall` in the **same** requirement that enters, leaves, or moves between those states. Write each as `StateA --> StateB: label`. The arrow is `-->`. `==>` is a flowchart arrow and draws no line in a state diagram. The label is the shortened event, without a leading number.

A diagram that only names states and has no `-->` line is not done. **Do not emit** a generic happy-path state machine, and do not add a state or an edge the text does not state.

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
8. Exception catalog
9. Per requirement: `<details id="req-N">` (closed) → summary (number, title, AC count, type badges only when the document has more than one type) → purpose card → AC matrix → decision table (if any) → mermaid (if any)
10. Coverage
11. Unmarked grill answers, when any remain
12. Footer (source path)

Legend of everyday-language type badges: once, near the index, and only as the type rule above says. No Tabs JS. Never show raw EARS keywords on the page.

**Stub** (no numbered EARS ACs): header, intro, open questions if any, not-canonical alert, `recipe:stub` — skip index shell, matrix, diagrams, screens, coverage, catalog.

## Labels

Headings and column titles use these strings. `spec.json` `language` `ja` uses the ja column; otherwise en.

| Token | ja | en |
| --- | --- | --- |
| `{{LABEL_OPEN}}` | 未決 | Open questions |
| `{{LABEL_SCREENS}}` | 画面 | Screens |
| `{{LABEL_TRANSITIONS}}` | 画面遷移 | Screen flow |
| `{{LABEL_FROM}}` | 開き方 | Opens from |
| `{{LABEL_ITEMS}}` | 項目 | Items |
| `{{LABEL_KIND}}` | 種類 | Kind |
| `{{LABEL_MANY}}` | 複数件 | Many |
| `{{LABEL_NOTICE}}` | 表示 | Notice |
| `{{LABEL_GOES}}` | 遷移先 | Goes to |
| `{{LABEL_FAILURE}}` | 失敗時 | On failure |
| `{{LABEL_BRANCH}}` | 分岐 | Branches |
| `{{LABEL_COL_DEST}}` | 行き先 | Place |
| `{{LABEL_COVERAGE}}` | 品質と確認 | Quality and checks |
| `{{LABEL_COVERAGE_LEAD}}` | それぞれの行で、右の結果が「確かめること」を満たすかを見ます。 | Each row asks whether the result on the right settles the question. |
| `{{LABEL_COL_QUESTION}}` | 確かめること | Question |
| `{{LABEL_GRILL_Q}}` | 質問 | Question |
| `{{LABEL_GRILL_A}}` | 回答 | Answer |
| `{{LABEL_GRILL_LEFT}}` | 画面に印を付けられなかった回答 | Answers not marked on this page |
| `{{LABEL_COL_BASIS}}` | この文書の結果 | Result in this document |
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

Quality and Checks keys are not shown. Use the gloss table in the Coverage section.

## Forbidden

- Inventing actors, systems, branches, screens, items, or requirements
- Sequence diagrams, pie/bar charts, heatmaps, term clouds, network graphs
- Any graph/chart CDN other than Mermaid
- Mermaid types other than `flowchart` and `stateDiagram` / `stateDiagram-v2`
- A cross-requirement flowchart other than the one screen transition
- A flowchart inside a screen card
- Naming a control or a failure form the sentence does not name (`テキスト入力`, `セレクトボックス`, `ボタン`, `項目直下のインラインテキスト`, `画面上部のアラート`, `ダイアログ`)
- Leaving an acceptance sentence in the item column (`が見える` still attached, or a whole `shall` response as one item)
- A screen item leaf `表示` when the cited AC or grill names a specific control or widget for that field
- Empty sections with placeholder lorem or “TBD” diagrams
- Omitting a diagram or limited-entry decision table when **Emit only when warranted** requires it for that requirement or the document (screen transition flowchart included)
- Changing `requirements.md`
- Generating the preview with a throwaway script instead of filling the template per this file

