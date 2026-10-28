---
name: sdd-req
description: Write the requirements delta for the current SDD issue. Use when the user runs /sdd-req.
---

# sdd-req

Docs directory: `__SDD_DOCS_DIR__`. Write bodies in `__SDD_LANG__`. Issue directory: `__SDD_DOCS_DIR__/issues/<current-branch>/`. Stop when that directory is missing.

Run `__SDD_RUNTIME__ __SDD_SCRIPT__ check --scope setup` first and stop on failure. Read `proposal.md`, related specs, and steering. Then ask, write, review, and finish in that order.

## Questions

Ask first about points that leave an acceptance result undecided, then about points the proposal marks for this phase. Look for gaps the proposal does not mention: each way a user reaches the behavior (a link, a direct URL, a retry), who creates the accounts or records the behavior needs, how the system knows an actor's role or permission and where that is stored, failure and empty states, and who may see or change what. Ask at most 5 questions at a time, and ask the next 5 after the answers arrive; rounds have no limit. Each question decides one thing, and each option states only the result that differs. Put background in one or two chat sentences before the questions, not in them. Keep a question near 30 characters and an option near 15 in ja, or near 12 and 6 words otherwise, not counting its score. Prefix each option with a score from 1 to 5, as in `[5] ...`, where 5 is best. The score weighs safety most, then closeness to the ideal form, then low implementation effort. List options from the highest score. The score is the recommendation, so add no separate recommended label. Leave unanswered questions under Open Questions as `- [ ] Qn: ...`, with every option you showed on its own indented line as `- [n] ...`, so a reviewer can see the alternatives. When answered, check the box, add ` (chosen)` to the chosen option or an indented `- Other: ... (chosen)` line for a free answer, and add `Answer:` plus where the answer landed: a delta id, a section such as `Definitions` in a named spec, or `no delta` when the answer is to require nothing.

## requirements.md

`example.md` next to this file is a complete file that passes `check`. Copy its headings, field names, and table shapes. Write `requirements.md` first, then stamp and check. A first check with reports is expected. Do not open `__SDD_SCRIPT__` before that check, and afterwards open it only for a report this skill and the example do not explain. Write the bodies in `__SDD_LANG__`, and keep only the parts the issue needs. Inside a SECTIONS item, write sub-headings two levels deeper than in the permanent file, as `#####` for `###`; apply moves them back.

Headings stay in English. Use Context, Open Questions, and `# Delta`. Context has Actors, Current behavior (existing ids, or `path:line` when specs do not exist yet), Proposal Coverage, and Assumptions. Do not repeat Why.

Proposal Coverage lists each What Changes item of `proposal.md` once, as `- <item>: <delta ids>`, `- <item>: out of scope: <reason>`, or `- <item>: design: <mechanism left to design>`. Design decides only mechanisms. What a user or caller can observe, such as the result of success, failure, refusal, or redirect, stays a requirement even when the proposal leaves the method to design.

Assumptions list only premises nobody was asked about. An answered question is recorded by its `Answer:` and its delta, not again in Assumptions, Constraints, or Purpose.

Delta order: Coverage, Structure, New domain, Domain metadata, New capability, Removed capability, spec file sections in path order, then `product.md` and `glossary.md` only. `architecture.md`, `tech.md`, `structure.md`, and topic files belong in `design.md`.

Change `product.md` only when the product purpose, its users, or its operational scenarios change. Do not restate capabilities there; the specs index lists them.

Coverage lists every touched capability and all four files as `changed` or `no change: <reason>`. Use one line, `none`, when specs do not change, and explain that in Context.

Use `spec.md` for behavior, `interfaces.md` for contracts at a boundary, `data.md` for persisted data, and `quality.md` for measurable quality. A boundary is an API, an event, a job, an external system, or code that another capability calls. A screen that shows content owned by another capability links it under Related and adds no interface. Each obligation belongs to one capability; others link to it instead of restating it. New ids are `REQ|IF|DATA|NFR-<CODE>-NEW-<k>`, and `Uses:` may name a provisional id. `MODIFIED` is a full replacement and includes `- change:`. `REMOVED` includes `- reason:`. Do not edit Identifier. A new spec needs Purpose and Scope. A new contract file needs METADATA and Purpose.

Field values come from fixed lists. Interfaces: `Kind` is `REST API`, `Event`, `File`, `UI`, `CLI`, `Library`, or `Batch`, and `Direction` is `Provided` or `Consumed`. A `Consumed` interface needs only `Direction` and `Uses: IF-...`. Data: `Classification` is `Public`, `Internal`, `Confidential`, or `Personal`, and a `Type` cell is `string`, `integer`, `decimal`, `boolean`, `date`, `datetime`, `enum(...)`, `ref(DATA-...)`, or `list<...>` of one of them. Quality: `Characteristic` is `Functional suitability`, `Performance efficiency`, `Compatibility`, `Interaction capability`, `Reliability`, `Security`, `Maintainability`, `Flexibility`, or `Safety`, and `Verification` is `Test`, `Analysis`, `Inspection`, or `Demonstration`.

## EARS

One requirement, one sentence, one obligation, one scenario or more. Include an exception scenario when failure behavior exists. Do not name tables, classes, or libraries. Put numbers in `quality.md`.

Choose the pattern from the trigger: Event-driven for an action or arrival, State-driven for a condition that holds, Unwanted behavior for errors and refusals. A scenario's When is an action or event, never a state. Its Then is a result a test can observe. A requirement that refuses or hides something states what is observed: the record stays unchanged, a message is shown, or no control is offered. Requirements with the same entry use the same trigger words, and a behavior with several entries covers each of them.

| Pattern | en | ja |
|---|---|---|
| Ubiquitous | `The <system> SHALL <response>.` | `<システム>は<応答>しなければならない。` |
| Event-driven | `When <trigger>, the <system> SHALL ...` | `<トリガー>とき、<システム>は…しなければならない。` |
| State-driven | `While <state>, the <system> SHALL ...` | `<状態>の間、<システム>は…しなければならない。` |
| Unwanted behavior | `If <condition>, then the <system> SHALL ...` | `<条件>場合、<システム>は…しなければならない。` |
| Optional feature | `Where <feature>, the <system> SHALL ...` | `<機能>を含む場合、<システム>は…しなければならない。` |

Each requirement sentence has exactly one `SHALL` in en. In ja, it has exactly one `なければならない`, conjugated to fit the verb as in `示さなければならない`, and the sentence ends there. Quoted text in `「」`, `『』`, double quotes, or backticks does not count.

Scenarios use `**Given**`, `**When**`, `**Then**`, `**And**` in en, and `**前提**`, `**もし**`, `**ならば**`, `**かつ**` in ja. For any other language, keep those English keywords and write the rest in `__SDD_LANG__`. Headings such as `#### REQ-...` and `##### Scenario:` stay in English. Define a term in the spec when one capability uses it, and in `glossary.md` when two or more do.

## Review

Before Finish, reread the whole file against this list. Fix each failure. Ask another round about a point the proposal and the answers do not settle, and leave it as an Open Question only when the user leaves it unanswered.

- Every What Changes item appears in Proposal Coverage, and no observable result is left to design.
- Each requirement has one obligation and one reading, and its own scenario decides pass or fail.
- No two requirements conflict, and no obligation appears in two capabilities.
- Every entry, actor, failure, and empty state the delta touches has a requirement or an Open Question.
- Who may see and change each record, whether stored text shown to users is displayed as plain text, and how one record is selected are each decided, asked, or listed under Proposal Coverage as design.
- Each decision appears once, apart from the `Answer:` pointer.

## Finish

Delete `base:` lines you rewrote, then run `__SDD_RUNTIME__ __SDD_SCRIPT__ stamp --issue <feature>` and `__SDD_RUNTIME__ __SDD_SCRIPT__ check --issue <feature>`. Commit only this issue directory, including `proposal.md` when it is still uncommitted, as `docs: ...` in `__SDD_LANG__`. Stage named paths. Do not use `git add -A` or `git add .`. A tracker key prefix becomes the commit scope.
