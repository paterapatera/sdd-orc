# sdd-orc

[日本語](README.ja.md)

Installs [Specification-Driven Development](https://github.com/paterapatera/sdd-orc) skills for Cursor, Codex, and Claude Code, and one shared checker script.

The package is `@paterapatera/sdd-orc` 0.3.20. Durable docs use format version 1 under a directory you choose (default `docs`): `knowledge/{specs,decision,steering}` plus `issues/`. Requires Node.js 18 or later.

Registering issues, opening pull requests, and writing `Closes #1` belong to a separate tracker skill. This package does not talk to a tracker.

## Install

From the repository root:

```sh
npx @paterapatera/sdd-orc init
```

`init` does not prompt. Defaults:

| Flag | Default |
|---|---|
| `--docs-dir` | `docs` |
| `--lang` | `en` (`en` or `ja`) |
| `--runtime` | `node` (`node` or `bun`) |
| `--base-branch` | `main` |
| `--skills-dir` | `.agents` (repeat the flag for each agent) |

Example for two agents:

```sh
npx @paterapatera/sdd-orc init --lang ja --runtime bun --skills-dir .agents --skills-dir .claude
```

This writes `sdd.config.json`, copies the same skills into every `<skills-dir>/skills/`, and copies one script to the first skills directory only:

```text
.agents/skills/sdd-scripts/sdd.mjs
```

Every skill calls that path. Commit `<skills-dir>` so CI can run the script without the network.

`init` creates the docs skeleton (`index.md`, `specs/index.md`, `specs/log.md`, `decision/index.md`). It does not create `steering/`. Use `/sdd-steering` for that. If the docs directory already contains Markdown that this layout does not manage, `init` stops and asks for a dedicated `--docs-dir`.

Passing different settings after install exits with an error. `--force` overwrites them.

## Update and migrate

```sh
npx @paterapatera/sdd-orc update
npx @paterapatera/sdd-orc migrate
```

`update` refreshes the skills and the shared script from `sdd.config.json` and bumps `version`. It leaves durable docs alone. If the package format is newer than `formatVersion`, it tells you to run `migrate` and writes nothing. Skills removed from the package are deleted from each skills directory with `UPDATE_REMOVED_SKILL` on stderr.

`migrate` will convert durable docs when a future format needs it, and it writes nothing when `check` fails. Format version 1 has nothing to convert.

## Shared script

Run the installed script with the runtime you chose. With the defaults:

```sh
node .agents/skills/sdd-scripts/sdd.mjs check
node .agents/skills/sdd-scripts/sdd.mjs stamp --issue <name>
node .agents/skills/sdd-scripts/sdd.mjs apply --issue <name>
node .agents/skills/sdd-scripts/sdd.mjs renumber [--base main] [--code OLD=NEW]
node .agents/skills/sdd-scripts/sdd.mjs index
node .agents/skills/sdd-scripts/sdd.mjs status [--issue <name>] [--all]
```

`check` reads durable docs and the issue for the current branch. `--issue` selects one. `--scope setup` checks only the config, the skeleton, and the five steering files. `--stage close` adds the close rules. `--stage impl` verifies implementation: optional `testCommand` in `sdd.config.json`, requirement ids referenced from automated test files (including untracked tests under git), and open implementation tasks (Manual verification is reported as notes only). `--allow-missing` succeeds when the issue directory is absent (for hotfix branches and Re-close). `--format json` prints `{ "ok", "diagnostics", "notes" }` for check. When steering or specs change descriptions and an `index.md` is stale, `check` regenerates index files before reporting other rules. Run the `index` command when you need to rebuild indexes without a full tree check (for example Re-close in `/sdd-close`); `apply` also regenerates indexes when it succeeds.

Optional `sdd.config.json` field `testCommand` runs during `check --stage impl` (skipped when unset).

`status` prints the current phase and next skill for the current branch, one `--issue`, or every issue with `--all`.

Exit codes are `0` (clean), `1` (a rule failed), and `2` (usage or setup). Lines look like `path:line: RULE message`.

`stamp` records a base hash on replacements and removals that do not have one. `apply` copies the issue delta into durable docs, numbers new ids, and writes nothing if the result would fail `check`. `index` rebuilds every `index.md` from descriptions. `renumber` gives a new number only to ids this branch added that already exist on the base branch. A new capability code that already exists on the base branch stops `renumber` until you pass `--code OLD=NEW`.

## Flows

Skills are English. Each one runs `check --scope setup` first. The branch name matches `issues/<name>/`.

Normal change:

1. `/sdd-init` writes `issues/<name>/proposal.md`.
2. `git checkout -b <name>`
3. `/sdd-req` writes `requirements.md`.
4. `/sdd-design` writes `research.md` and `design.md`.
5. `/sdd-task` writes `task.md`.
6. `/sdd-impl` implements the open tasks. `/sdd-fix` repairs a mismatch.
7. `/sdd-close` merges the base branch, runs `apply`, runs `check --stage close`, deletes the issue directory, and prints a pull request title and body.

Small change: `/sdd-init`, then `/sdd-quick`, then `/sdd-close`. Quick does not ask questions and does not write requirements, research, or design. It stops when the change needs specs, steering, or decisions.

Document existing behavior: `/sdd-init` with `Type: docs`, then `/sdd-reverse`, then `/sdd-close`. Reverse adds requirements only.

Adopting SDD on a running app: run `init`, complete `/sdd-steering` (including spec–code id cross-check when specs already exist), then open issues with `/sdd-init` and continue with `/sdd-reverse` or `/sdd-req` as each proposal requires.

Several proposals at once (the usual way to start):

1. Run `/sdd-init` once per change on the base branch.
2. Register the issues in your tracker, or do that with a separate tracker skill, and prefix each directory with the tracker key.
3. Commit the `proposal.md` files on the base branch.
4. Start one with `git checkout -b <key>-<name>` and continue from `/sdd-req` or `/sdd-quick`.
5. `/sdd-close` deletes that issue directory on the branch. The merge removes it from the base branch.

## Manual verification scripts

Optional scripts under `scripts/` exercise SDD flows outside the automated test suite (they are not run by `node --test`):

- `node scripts/laravel-fixture-walkthrough.mjs` — temp-repo walkthrough similar to a Laravel project.
- Clone [laravel-fp](https://github.com/paterapatera/laravel-fp), then `node scripts/laravel-fp-walkthrough.mjs` (or set `LARAVEL_FP` to the clone path).

## Pull requests

Run `check` in pull request CI and make that check required. Also require the branch to be up to date with the base branch before merge. Those are recommendations for your repository settings. This package does not require them.

The job below only runs the shared script. It does not call a tracker or a CI product beyond the workflow runner.

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

Use `bun` instead of `node` when `sdd.config.json` says `"runtime": "bun"` and Bun is installed. The bundled `sdd.mjs` is a Node script (`#!/usr/bin/env node`); when Bun is missing, run it with Node anyway, for example `node .agents/skills/sdd-scripts/sdd.mjs check`. Use Node 18 or later (the CI example below uses 24). Skills may still show `bun` in examples when `runtime` is `bun`; substitute `node` on the command line when needed. If the script lives under another skills directory, use that path.
