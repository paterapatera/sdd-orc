# Requirements HTML checklist

Run this after the HTML is written. Every item is pass or fail. Done means every item passes. Quote the viz-rules line that decides a fail, then fix the HTML and run the list again.

Do not change `requirements.md`, `spec.json`, or `req-grill.md` while fixing.

## Source

- The preview sits next to `requirements.md`. No other spec file changed.
- Visible sentences match the source. No added requirement, screen, item, actor, or branch.
- `(source: …)` tags are not visible. The sentence they were on is still there.

## Page

- Section order matches **Page-level structure** in `viz-rules.md`. Empty sections are omitted.
- The TOC lists only emitted sections.
- Each requirement is one `<details id="req-N">` that is closed. The purpose card, AC matrix, decision table if any, and mermaid if any are inside that element, before `</details>`.
- A stub with no numbered EARS lines has the header, intro, open questions when any exist, the not-canonical alert, and the stub recipe. It has no index, matrix, diagram, screens, coverage, or catalog.

## Forbidden

- No sequence diagram, pie, bar, heatmap, term cloud, or network graph.
- The only chart library is Mermaid. Types are `flowchart` and `stateDiagram` / `stateDiagram-v2` only.
- One cross-requirement flowchart: the screen transition. No flowchart inside a screen card.
- An item kind is a control the sentence names. `項目直下のインラインテキスト` and `ダイアログ` are not `表示`.
- An item cell is a noun, not an acceptance sentence.
- No empty section and no placeholder diagram.

## Coverage

- One row per `## Quality` key, then one row per `## Checks` key, in source order.
- The kind is the key before the first colon on that line (`lockout`, `functional`). Do not classify the row by searching for `out` inside the line. `lockout` is not an `out:` row unless the value after the key starts with `out:`.
- The name cell is the gloss from `viz-rules.md`, not the raw key. The basis cell is the cited response, or the `out:` sentence.

## Grill

- Skip `## DEFERRED`, `## AI Answers`, and a choice with no answer.
- Each remaining Human choice is either inside one `span.req-grill` tip, or one item in `#grill-left`. Not both. Not neither.
- The tip and the leftover item copy the question and the answer from `req-grill.md`.
- Omit `#grill-left` when every choice is marked, or when `## Human choices` is empty.
- A Mermaid label is not a `span.req-grill`.

## Diagrams

- The screen transition exists only when `## Screens` has a `###` heading. Each edge is one navigation sentence from `from` or `goes`. No edge comes from a `failure` line.
- A requirement flowchart exists only when `viz-rules.md` **Mermaid flowchart** says emit: two or more `When` lines, or one `When` plus an `If` that is the failure of that same event, and the lines read as a sequence or branch without added steps. Otherwise it is absent.
- A state diagram exists only when that requirement has two or more `While` lines, or a `While` plus a `When` that names a state change the text states. Otherwise it is absent. When it exists, every enter, leave, or move that a `When` or `shall` in that requirement states is a `-->` line. `==>` is absent. A diagram that only names states fails.
- A decision table exists only when the same subject has two or more conditions that combine, and the cells do not invent a combination. It is not built from screen lines.
- Every node and edge label is Markdown-safe for Mermaid 11. No label starts with a number, a period, and a space (`3. When`). No label starts with `#`, `*`, `-`, or `>`. Drop the acceptance-criterion number from an edge label.
