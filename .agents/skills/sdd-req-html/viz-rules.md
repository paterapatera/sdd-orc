# Visualization rules

Read this before filling [template.html](template.html). Prefer omission over a diagram that invents edges or behavior.

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

## Always emit (if the source section exists)

### Scope

Read `## Boundary`. Two cards: lines whose key is `in` / `out` (also `**In**` / `**Out**`). Drop a card whose text is empty. Drop the section if both are empty. Do not invent an adjacent system. A line `Open question:` stays out of the cards.

### Requirement index

One table. Columns: ID (link to `#req-N`), purpose (the `**Purpose:**` sentence), AC count, type badges (unique types present). The requirement id is the number on `## <n>`. The column title is `{{LABEL_COL_PURPOSE}}`, not the markdown label.

### Acceptance-criteria matrix (per requirement)

Every requirement with ≥1 AC gets a table:

`#` | subject | condition | type (badge) | response

Type column: `<span class="badge" data-ears="when|if|while|where|shall">{{LABEL_EARS_*}}</span>`.

Visible badge text is everyday language (see SKILL.md `{{LABEL_EARS_*}}`). Do **not** put `When` / `If` / `While` / `Where` / `shall` on the page — those stay in `requirements.md` only. `data-ears` stays English for CSS.

### Exception catalog (document-level)

Collect every `If` AC across requirements. Table: requirement link (`#req-N`) | AC # | condition | response.

Omit the section if there are zero `If` ACs.

### Purpose / user-story card (per requirement)

Parse `**Purpose:**`. A legacy `**目的:**` line is the same sentence. Put the whole sentence in the card body. Do not split it into a role, a capability, and a benefit. The card title is `{{LABEL_STORY}}`.

## Emit only when warranted

### Mermaid flowchart (`flowchart`)

Emit **inside that requirement** when **all** of:

- The requirement has **two or more** `When` ACs, **or** one `When` plus at least one `If` that is clearly the failure of that same event
- The ACs can be read as a sequence or branch **without adding** intermediate steps

Node labels: shorten AC condition/response; keep meaning. Edges: only order/branch that the AC text supports (`If` as a no/error branch of a `When` is allowed when the trigger matches).

**Do not emit** for a single lonely `When`, for ubiquitous `shall` lists, or for a document-level “feature flow” stitched across requirements.

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

**Do not emit** when ACs are a flat list of independent events, or when you would need a “full combinatorial” expansion the md does not describe.

## Page-level structure (order)

1. Header (title, link to `requirements.md`, generated timestamp, not-canonical alert)
2. TOC (intro, scope if present, index, exceptions if present, each `req-N`)
3. Introduction, only when the file has prose before `## Boundary`
4. Scope
5. Requirement index
6. Exception catalog
7. Per requirement: `<details open id="req-N">` → purpose card → AC matrix → decision table (if any) → mermaid (if any)
8. Footer (source path)

Legend of everyday-language type badges: once, near the index (not a filter UI). No Tabs JS. Never show raw EARS keywords on the page.

## Forbidden

- Inventing actors, systems, branches, or “implied” requirements
- Sequence diagrams, pie/bar charts, heatmaps, term clouds, network graphs
- Any graph/chart CDN other than Mermaid
- Mermaid types other than `flowchart` and `stateDiagram` / `stateDiagram-v2`
- Cross-requirement flowcharts
- Empty sections with placeholder lorem or “TBD” diagrams
- Changing `requirements.md`

## Stub documents

If the md has no numbered EARS ACs (init stub): emit header, intro, not-canonical alert, and `recipe:stub`. Skip index, matrix, diagrams, catalog, and the `#index` shell section.
