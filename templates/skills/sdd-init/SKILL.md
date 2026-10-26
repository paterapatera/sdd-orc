---
name: sdd-init
description: Create an SDD proposal for a new change. Use when the user runs /sdd-init or asks to open an SDD issue.
---

# sdd-init

Docs directory: `__SDD_DOCS_DIR__`. Write bodies in `__SDD_LANG__`. Base branch: `__SDD_BASE_BRANCH__`.

Run `__SDD_RUNTIME__ __SDD_SCRIPT__ check --scope setup` first. Stop unless it passes. This command does not commit.

## Steps

1. Read the requested change, `__SDD_DOCS_DIR__/specs/`, and `__SDD_DOCS_DIR__/steering/`.
2. Propose a feature name: lowercase kebab-case, at most 40 characters. A tracker key may be a prefix (`1-invoice-reissue` or `PROJ-123-invoice-reissue`). Stop if that directory or branch already exists, with or without a key.
3. Ask at most 3 questions, only to settle Why, What Changes, and Out of Scope. Each question decides one thing, and each option states only the result that differs. Put background in one or two chat sentences before the questions, not in them. Keep a question near 30 characters and an option near 15 in ja, or near 12 and 6 words otherwise, not counting its score. Prefix each option with a score from 1 to 5, as in `[5] ...`, where 5 is best. The score weighs safety most, then closeness to the ideal form, then low implementation effort. List options from the highest score.
4. Write `__SDD_DOCS_DIR__/issues/<feature>/proposal.md` with `# <title>`, Why, What Changes, Impact, and Out of Scope. The title is one line in `__SDD_LANG__` and does not contain the feature name or tracker key.
5. Impact always has Type, Capabilities, Steering, Decisions, and Code. Use `none` when an item does not apply. Type is a Conventional Commits type. Capabilities use New, Modified, Removed, Moved, Split, or Merged plus a `/specs/...` path. Name a new domain explicitly.
6. When Capabilities cross two domains, or six or more capabilities, suggest splitting the issue. Do not force the split.
7. Do not rename directories or branches, and do not create the branch.

## Commit

Do not commit `proposal.md`. A later `/sdd-req`, `/sdd-quick`, or `/sdd-reverse` commit includes it unless it was already committed on the base branch.
