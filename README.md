# sdd-orc

[日本語](README.ja.md)

**sdd-orc** installs agent skills and one checker script so you can run [Specification-Driven Development (SDD)](https://github.com/paterapatera/sdd-orc) in Cursor, Codex, or Claude Code. You invoke skills such as `/sdd-init` and `/sdd-req` in chat; the agent writes Markdown and runs the checker through those skills. Package: `@paterapatera/sdd-orc` 0.3.20. Node.js 18 or later.

Registering tracker issues, opening pull requests, and writing `Closes #1` belong to a separate tracker skill. This package does not talk to a tracker.

## Folders you work with

Default docs root is `docs` (override with `npx @paterapatera/sdd-orc init --docs-dir <path>`).

| Path | Meaning |
|---|---|
| `docs/knowledge/` | Specs, ADRs, and steering that stay on the main branch |
| `docs/issues/<name>/` | Draft for one change while you are on Git branch `<name>`; removed when you close |

```text
docs/
  knowledge/          ← permanent specs, decision/, steering/
  issues/<name>/      ← change summary, requirements, design, task (while on branch <name>)
```

Skill text is **English**. Branch name must match the issue folder name (for example branch and folder `invoice-fix`, or `PROJ-12-invoice-fix` with a tracker prefix).

## Install

```sh
npx @paterapatera/sdd-orc init
```

**After installing:** In **agent chat**, run `/sdd-steering` first. It creates the steering documents under `docs/knowledge/steering/` (the install command does not). If the repository already has application code, the skill also reads the code and updates steering to match; on a new project it creates the initial steering set. Then start each change with `/sdd-init` on the base branch.

| Flag | Default |
|---|---|
| `--docs-dir` | `docs` |
| `--lang` | `en` |
| `--runtime` | `node` |
| `--base-branch` | `main` |
| `--skills-dir` | `.agents` (repeat per agent) |

Example:

```sh
npx @paterapatera/sdd-orc init --lang ja --runtime bun --skills-dir .agents --skills-dir .claude
```

This writes `sdd.config.json`, copies skills to each `<skills-dir>/skills/`, and installs the checker at the first skills dir only (for example `.agents/skills/sdd-scripts/sdd.mjs`). Commit `<skills-dir>` so CI can run `check` offline.

`npx @paterapatera/sdd-orc init` creates `docs/knowledge/` skeleton files. It does not create `steering/` (see **After installing** above). If unrelated Markdown already lives under the docs dir, the command stops; pick another `--docs-dir`. After install, different settings require `--force`.

## Update

```sh
npx @paterapatera/sdd-orc update
npx @paterapatera/sdd-orc migrate
```

`update` refreshes skills and the script; it does not edit `knowledge/`. `migrate` is for future format changes; format version 1 has nothing to convert.

## Script and status

Skills run the bundled checker (`check`, `stamp`, `apply`, `renumber`, `index`, and related steps) during each phase. You do not need to run those commands yourself in normal work.

To see the current phase and the next skill for your branch, run:

```sh
node .agents/skills/sdd-scripts/sdd.mjs status
```

Add `--issue <name>` or `--all` when you want a specific issue or every open issue.

If `/sdd-impl` should run your test suite automatically, set optional `testCommand` in `sdd.config.json`.

## Skills included

`/sdd-init`, `/sdd-req`, `/sdd-design`, `/sdd-task`, `/sdd-impl`, `/sdd-fix`, `/sdd-close`, `/sdd-quick`, `/sdd-reverse`, `/sdd-steering`.

## Which path to take

After `/sdd-init` creates the change summary file, it picks the path for you and names the next skill (for example `/sdd-quick` or `/sdd-req`). Create the branch and follow that skill.

```mermaid
flowchart TD
  init["/sdd-init"] --> branch["git checkout -b name"]
  branch --> route{Kind of change}
  route -->|Small fix, no spec or steering change| quickPath["/sdd-quick then /sdd-close"]
  route -->|Write down behavior that already exists| revPath["/sdd-reverse then /sdd-close"]
  route -->|New feature or spec change| fullPath["/sdd-req through /sdd-close"]
  quickPath --> noteQuick["Tasks only, no requirements or design docs"]
  revPath --> noteRev["Add requirements to match the code"]
```

### Normal feature

New behavior or a spec change. After init points you to `/sdd-req`:

```mermaid
flowchart LR
  R["/sdd-req"] --> D["/sdd-design"]
  D --> T["/sdd-task"]
  T --> I["/sdd-impl"]
  I --> F{Drift?}
  F -->|yes| X["/sdd-fix"]
  X --> I
  F -->|no| C["/sdd-close"]
```

Steps (**agent chat** unless noted):

1. **Agent chat:** `/sdd-init` on the base branch (creates the change summary; no branch yet).
2. **Terminal:** `git checkout -b <name>` (same name as the issue folder init chose).
3. **Agent chat:** `/sdd-req` → `/sdd-design` → `/sdd-task` → `/sdd-impl`; commit docs as each skill says. If docs or code drift, `/sdd-fix` then continue.
4. **Agent chat:** `/sdd-close` merges the base branch, updates permanent docs, removes the issue folder, and prints PR title and body (does not open the PR).

### Quick (small change)

A small fix that does not change requirements, steering, or decision records. Same steps 1–2 as above, then **agent chat** `/sdd-quick` (task list only) → `/sdd-close`. The skill stops if a spec or steering update is needed.

### Reverse (document existing behavior)

Use reverse when the **code already behaves a certain way** but specs do not describe it yet. Typical cases: right after you adopt SDD on an existing app (backfill specs from the code), or when you find behavior you want to keep and it is not written down.

Do **not** start with `/sdd-reverse` alone. On the **base branch**, **agent chat** `/sdd-init` and say you are **documenting existing behavior** (not shipping new features). Init writes the change summary and tells you to run `/sdd-reverse` next. Then **terminal** `git checkout -b <name>`, **agent chat** `/sdd-reverse` → `/sdd-close`. Design and task documents are often skipped; close still runs checks.

## Using with GitHub issues

Optional pattern when you track work in GitHub Issues (this package does not create issues or PRs; use a separate tracker skill or GitHub by hand).

1. **Agent chat:** On the base branch, `/sdd-init` once per planned change.
2. Create a GitHub issue for each change (tracker skill or manually).
3. Use a folder and branch name that starts with the issue number or key (example: `42-invoice-fix`).
4. **Terminal:** Commit the change summaries on the base branch.
5. **Terminal:** `git checkout -b <name>` per issue; **agent chat:** run skills through `/sdd-close`. Link the PR to the issue (`Closes #42`) when you open it yourself or via your tracker skill.

## Where you decide (not the script)

| Skill | You |
|---|---|
| `/sdd-init` | Up to 3 questions about purpose, what changes, and what is out of scope |
| `/sdd-req`, `/sdd-design`, `/sdd-reverse`, `/sdd-fix` | Up to 5 scored choices per round |
| `/sdd-steering` Resync | Accept, reject, or defer each reported item |
| `/sdd-impl` | Complete manual verification tasks in the task list (not auto-checked) |
| `/sdd-close` | Resolve merge conflicts; confirm renamed spec codes if prompted; copy PR text |

Quick path asks no questions. `/sdd-task` asks no questions.

## Pull request CI (recommended)

```yaml
name: sdd
on:
  pull_request:
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
      - run: node .agents/skills/sdd-scripts/sdd.mjs check
```

Making this check required and keeping the branch up to date with the base branch are repository settings; this package does not enforce them.
