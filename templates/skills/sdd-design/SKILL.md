---
name: sdd-design
description: Research options and write the design delta for the current SDD issue. Use when the user runs /sdd-design.
---

# sdd-design

Docs directory: `__SDD_DOCS_DIR__`. Write bodies in `__SDD_LANG__`. Issue directory: `__SDD_DOCS_DIR__/issues/<current-branch>/`. Stop when it is missing.

Run `__SDD_RUNTIME__ __SDD_SCRIPT__ check --scope setup` first; it prints `ok: setup` when it passes. List the issue directory to see which files exist. Stop when `requirements.md` has an open `- [ ] Q` item, and tell the user to finish `/sdd-req`.

`example-research.md` and `example-design.md` next to this file pass `check` together with the `/sdd-req` example. Copy their headings, field names, and table shapes. Write the bodies in `__SDD_LANG__`, and keep only the parts the issue needs. Write both files first, then run `__SDD_RUNTIME__ __SDD_SCRIPT__ stamp --issue <feature>` and `__SDD_RUNTIME__ __SDD_SCRIPT__ check --issue <feature>`. A first check with reports is expected. Do not open `__SDD_SCRIPT__` before that check, and afterwards open it only for a report this skill and the examples do not explain.

## research.md

Write Questions (`RQn`), Findings, Options (`Dn`), Conclusions, and `# Delta`. Every finding bullet ends with `(source: ...)`: `path:line`, an id, a URL with an access date, or a command plus its result. ADR candidates are decisions that are expensive to reverse, that affect more than one capability, or that change specs or steering. Updating names, file lists, or code-to-specs mappings in steering to match the design is not a decision. Ask the user to choose those, at most 5 questions at a time. Ask the next 5 after the answers arrive; rounds have no limit. Each question decides one thing, and each option states only the result that differs. Put background in one or two chat sentences before the questions, not in them. Keep a question near 30 characters and an option near 15 in ja, or near 12 and 6 words otherwise, not counting its score. Prefix each option with a score from 1 to 5, as in `[5] ...`, where 5 is best. The score weighs safety most, then closeness to the ideal form, then low implementation effort. List options from the highest score. The score is the recommendation, so add no separate recommended label. The option table under each `Dn` keeps every option you showed, including the ones not chosen. Decide the other points yourself. Each conclusion is `Dn: <choice> -> ADR-NEW-<k>` or `-> No ADR (<reason>)`.

An added ADR is readable without `research.md`. Use MADR headings two levels deeper than the permanent file. Do not write Status or Date; apply adds them. The ADR file name is `<n>-<slug>.md`. When the title is not in English, add `- slug: <english-kebab-case>` under the ADR heading, as in the example; otherwise the slug comes from the ASCII letters and digits of the title, or is `adr-<n>` when it has none. `SUPERSEDED`, `DEPRECATED`, and `AMENDED` follow the delta vocabulary: `### ADR-<n> -> ADR-NEW-<k>` under `## SUPERSEDED`, `### ADR-<n>` with `- reason:` under `## DEPRECATED`, and `### ADR-<n>` with `- title:`, `- description:`, `- tags:`, or `#### Related` under `## AMENDED`. `AMENDED` is only a typo, link, title, description, tags, or Related. Supersede a decision instead of rewriting it.

## design.md

Write Overview, Requirements Traceability, Components and Interfaces, Data Model, Error Handling, Testing Strategy, Migration, and `# Delta`. Trace every ADDED, MODIFIED, and REMOVED id of the requirements delta, and no other id, to components and a test level: Unit, Integration, Contract, E2E, Performance, Security, or Manual. Use `none` for traceability when specs do not change, and then say that Testing Strategy runs the full existing test suite. Data Model, Error Handling, and Migration are `none` when unused.

Stop and return to `/sdd-req` when the design needs an interface or data change that is not in the requirements delta. Steering deltas here are only `architecture.md`, `tech.md`, `structure.md`, and topic files. Follow steering. When the design departs from it, change steering in the delta. Stamp adds `base:` to each replaced section.

Inside a steering section, write sub-headings two levels deeper than in the permanent file, as `#####` for `###`; apply moves them back. Apply replaces a whole section, so a section carries at most one rationale. Add `- rationale: ADR-NEW-<k>` or `- rationale: ADR-<n>` on the first line under the section heading, never under a sub-heading, only when that ADR's decision is what changes the section. A section that only updates names, file lists, or mappings has no rationale. Do not put a `No ADR` decision inside a section with a rationale. When steering must record a `No ADR` decision, make it an ADR candidate instead; otherwise keep it in `design.md`.

`Runs on` is Local, CI, Staging, or Human. Contract tests check the shape without the counterpart running. Performance tests measure latency, throughput, or error rate. Security tests include SAST, DAST, or vulnerability checks.

## Review

Before Finish or handing off to `/sdd-task`, reread both files against this list yourself. Fix each failure. Do not treat this list as a substitute for the person's Manual verification later.

- Every requirements delta id appears in Requirements Traceability with a test level that matches how it will be verified (Manual only when a person must look).
- No two traced ids share the same obligation in conflicting ways; MODIFIED text matches the requirements delta.
- Testing Strategy includes a table with Test Level and Runs on when traceability is not `none`.
- Components and Interfaces match the traceability components and are testable at the chosen levels.
- Steering deltas follow the rationale rules above; gaps from `/sdd-brownfield` are either closed or called out in Overview.

## Finish

Run stamp and check again after every edit. Commit `research.md` and `design.md` together as one `docs` commit. Stage only this issue directory.
