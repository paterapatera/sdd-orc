---
name: kiro-worktree
description: >-
  Creates a Git worktree and feature-named branch for each docs/specs/{feature}
  directory at ../{feature}, then runs worktrees.json setup (Cursor
  worktrees equivalent). Use when the user invokes /kiro-worktree,
  asks to batch-create feature worktrees, or wants isolated checkouts per spec.
disable-model-invocation: true
---

# kiro-worktree

Batch-create Git worktrees for every feature under `docs/specs/{feature}`.

- Destination: `../{feature}` (sibling of the main checkout)
- Branch: `{feature}` — create only if it does not already exist
- After a **new** worktree is created, run setup from `worktrees.json` (same keys/behavior as [Cursor worktrees](https://cursor.com/docs/configuration/worktrees), but the file lives at the repo root rather than `.cursor/`)

## Instructions

1. Confirm the current directory is inside the target Git repository.
2. **Execute** (do not reimplement) the script. Request `required_permissions: ["all"]` because destinations are outside the workspace:

```bash
python3 .agents/skills/kiro-worktree/scripts/create_feature_worktrees.py
```

Optional args:

| Invocation | Effect |
|---|---|
| (no args) | Every `docs/specs/*` directory |
| `auth billing` | Only those feature names |
| `--dry-run` | Print planned `git worktree add` actions; create nothing |
| `--skip-setup` | Create worktrees only; skip `worktrees.json` |
| `--specs-dir PATH` | Override inventory (default `docs/specs`) |

3. Report the script's per-feature lines to the user. Do not mark success if the script exits non-zero.

## Worktree rules

- Main checkout path = first `worktree` line from `git worktree list --porcelain`.
- Destination = `{main_parent}/{feature}`.
- Feature list = immediate subdirectories of `docs/specs/` (skip hidden names).
- **Existing local branch** `{feature}` → `git worktree add ../{feature} {feature}` (do not recreate the branch).
- **No local branch, remote `origin/{feature}` exists** → `git worktree add -b {feature} ../{feature} origin/{feature}`.
- **Neither exists** → `git worktree add -b {feature} ../{feature}` from current `HEAD`.
- Skip when the destination is already a worktree, or `{feature}` is already checked out in another worktree.
- Fail that feature (continue others) if `../{feature}` exists and is **not** a worktree.
- Do **not** re-run setup for skipped/existing worktrees.

## worktrees.json setup (Cursor-equivalent)

Look for `worktrees.json` in this order:

1. `{worktree}/worktrees.json`
2. `{main}/worktrees.json`

Supported keys (first match wins):

- Unix/macOS/WSL: `setup-worktree-unix`, else `setup-worktree`
- Windows: `setup-worktree-windows`, else `setup-worktree`

Each key is either:

- **string** — script path relative to the directory that contains `worktrees.json` (repo root)
- **array of strings** — shell commands run sequentially in the worktree (`bash -c`)

Run setup with:

- cwd = the new worktree
- `ROOT_WORKTREE_PATH` = absolute path of the main checkout

Stop that feature's setup on the first failing command. Keep the worktree; report the setup error.

If the file is absent, skip setup.

Do not symlink `node_modules` / virtualenvs from the main checkout into the worktree.

## Out of scope

- Do not write `worktrees.json` unless the user asks.
- Do not delete, prune, or move worktrees.
- Do not commit, push, or open PRs.
- Do not switch the current session's workspace root.
