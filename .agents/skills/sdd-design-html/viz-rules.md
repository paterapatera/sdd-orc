# Visualization rules

Read this before filling [template.html](template.html). Prefer omission over a diagram or table that invents edges, components, or coverage.

## What to read

`design.md` has `## Overview`, a `## Record` json fence, and headings only for ids that exist in that fence.

| Slot | Source |
| --- | --- |
| Overview | `## Overview` prose |
| Boundary | `Record.owns`, `Record.must_not`, `Record.depends` |
| Current | `Record.current` when it is an object |
| Decisions | `## Decisions` / `### D-<name>`, matched to `Record.decisions[]` by `id` |
| Failures | `## Failures` / `### <req id>`, matched to `Record.failures[].req` |
| Components | `#### <Name> {#D-<Name>}`, matched to `Record.components[].id` |
| Files | `Record.files` |
| Contracts | `Record.contracts` |

Ignore a heading that is not in this table. Do not look for Goals, Architecture, Technology Stack, Persistent References, Data Models, Observability, Testing Strategy, or Operational Readiness. If one of those headings is present in an older file, omit it.

## Always emit (if the source is non-empty)

### Overview

The Overview paragraphs. Drop empty placeholders.

### Boundary

Three cards: owns / must_not / depends. Drop a card whose array is missing or empty. Drop the section if all three are empty.

### Current

One card when `current.constraint` is a non-empty string. Show `evidence` as a path. Omit when `current` is null or absent.

### Decisions

One card per `### D-<name>`: the heading's sentence, plus `choose` and `rejected` from the matching object. Omit `rejected` when null. Omit the section when there are no decision headings.

### Failures

One row per `### <req id>`: the requirement id and the sentence. Omit when the section is missing.

### Components

One row per `#### Name {#D-Name}`: anchor, the responsibility sentence, `reqs`, and `io` from the matching object. Link the anchor to `#D-Name`. Omit when there are no such headings.

### Files

One row per `files[]` object with a non-empty `path`: path and change. Omit when the array is empty.

### Contracts

One row per `contracts[]` object: path and mode badge `modify` or `reference`. Omit when the array is empty. Do not fetch contract bodies.

## Diagrams

Copy a fenced `mermaid` only when it already sits under Decisions, Failures, or Components. Allowed types: `flowchart` / `graph`, `sequenceDiagram`, `stateDiagram` / `stateDiagram-v2`, `erDiagram`. Skip any other type. Do not invent a diagram.

## Page order

1. Header (title, link to `design.md`, generated timestamp, not-canonical alert)
2. Overview
3. Boundary
4. Current
5. Decisions
6. Failures
7. Components
8. Files
9. Contracts
10. Footer (source path)

Omit a step whose source is empty. TOC lists only the emitted steps.

## Coverage gap

When `requirements.md` exists, collect numeric requirement ids from headings such as `## 1`. An id is covered when it appears in `design.md`. List uncovered ids. Omit the alert when every id is covered or the requirements file is missing.

## Forbidden

- Inventing components, actors, edges, requirement ids, or contract paths
- Re-rendering EARS matrices from `requirements.md`
- Charts other than an allowed mermaid fence that is already in the markdown
- Empty sections and placeholder diagrams
- Changing `design.md`

## Stub documents

Treat as stub when Overview is empty and `Record` has no non-empty `owns`, `decisions`, `failures`, or `components`. Emit the header, the not-canonical alert, and `recipe:stub`.
