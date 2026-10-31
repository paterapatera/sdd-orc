---
name: sdd-init
description: Create an SDD proposal for a new change. Use when the user runs /sdd-init or asks to open an SDD issue.
---

# sdd-init

Docs directory: `__SDD_DOCS_DIR__`. Write bodies in `__SDD_LANG__`. Base branch: `__SDD_BASE_BRANCH__`.

Run `__SDD_RUNTIME__ __SDD_SCRIPT__ check --scope setup` first. Stop unless it passes. This command does not commit.

## Steps

1. Read the requested change, `__SDD_KNOWLEDGE_DIR__/specs/`, and `__SDD_KNOWLEDGE_DIR__/steering/`. You may read only `__SDD_KNOWLEDGE_DIR__/lessons/index.md` (not individual lesson pages) when the change fixes something missed in a previously closed issue.
2. Propose a feature name: lowercase kebab-case, at most 40 characters. A tracker key may be a prefix (`1-invoice-reissue` or `PROJ-123-invoice-reissue`). Stop if that directory or branch already exists, with or without a key.
3. Ask at most 3 questions, only to settle Why, What Changes, and Out of Scope. Each question decides one thing, and each option states only the result that differs. Put background in one or two chat sentences before the questions, not in them. Keep a question near 30 characters and an option near 15 in ja, or near 12 and 6 words otherwise, not counting its score. Prefix each option with a score from 1 to 5, as in `[5] ...`, where 5 is best. The score weighs safety most, then closeness to the ideal form, then low implementation effort. List options from the highest score. The score is the recommendation, so add no separate recommended label.
4. Write `__SDD_DOCS_DIR__/issues/<feature>/proposal.md` with `# <title>`, Why, What Changes, Impact, and Out of Scope. The title is one line in `__SDD_LANG__` and does not contain the feature name or tracker key.
5. Impact always has Type, Capabilities, Steering, Decisions, and Code. Use `none` when an item does not apply. Steering lists only the files whose text would be wrong after this change; do not list a file that is merely related or touched. A change inside existing files, or one that adds no new file, usually leaves steering `none`. Decisions likewise lists only the ADRs this change would supersede, deprecate, or add. Type is a Conventional Commits type. Capabilities use New, Modified, Removed, Moved, Split, or Merged plus a `/specs/...` path. Name a new domain explicitly.
6. When Capabilities cross two domains, or six or more capabilities, suggest splitting the issue. Do not force the split.
7. Do not rename directories or branches, and do not create the branch.
8. Name the next skill: `/sdd-quick` when Capabilities, Steering, and Decisions are all `none`, `/sdd-reverse` for `Type: docs` that only records existing behavior, and `/sdd-req` otherwise.

`check` reads only the `- Type:` line of `proposal.md`, so there is no need to open `__SDD_SCRIPT__`. Follow this shape, and write the text in `__SDD_LANG__`:

```markdown
# Credit notes for returned orders

## Why

Clerks refund returned orders by hand, and accounting cannot see the refunds.

## What Changes

- Clerks issue a credit note for a returned order.
- Accounting receives each credit note.

## Impact

- Type: feat
- Capabilities: New /specs/returns/credit-note (new domain /specs/returns), Modified /specs/billing/invoice
- Steering: /steering/tech.md
- Decisions: none
- Code: invoice screens and the accounting client

## Out of Scope

- Partial refunds
```

## Commit

Do not commit `proposal.md`. A later `/sdd-req`, `/sdd-quick`, or `/sdd-reverse` commit includes it unless it was already committed on the base branch.

## Issue feedback (`feedback.md`)

When this issue fixes something that should have been caught in a previously closed issue (for example post-merge CI or staging failure), append to `__SDD_DOCS_DIR__/issues/<feature>/feedback.md` (create with `# Feedback` if missing): `## YYYY-MM-DD sdd-init — missed-prior-close` and a short summary of what was missed and which closed issue it relates to.
