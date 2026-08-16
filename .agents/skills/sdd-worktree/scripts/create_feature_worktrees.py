#!/usr/bin/env python3
"""Create a Git worktree per docs/specs/{feature} and run worktrees.json setup.

Worktrees are created as siblings of the main checkout: ../{feature}.
Equivalent setup behavior: https://cursor.com/docs/configuration/worktrees
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Any


class UserError(Exception):
    pass


def run_git(
    args: list[str],
    *,
    cwd: Path | None = None,
    check: bool = True,
) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["git", *args],
        cwd=cwd,
        check=check,
        text=True,
        capture_output=True,
    )


def git_out(args: list[str], *, cwd: Path | None = None) -> str:
    return run_git(args, cwd=cwd).stdout.strip()


def discover_main_repo() -> Path:
    try:
        run_git(["rev-parse", "--is-inside-work-tree"])
    except subprocess.CalledProcessError as exc:
        raise UserError("Not inside a Git work tree. Run from the repository.") from exc

    porcelain = git_out(["worktree", "list", "--porcelain"])
    for line in porcelain.splitlines():
        if line.startswith("worktree "):
            return Path(line.split(" ", 1)[1]).resolve()
    raise UserError("Could not determine the main worktree from `git worktree list`.")


def list_features(specs_dir: Path) -> list[str]:
    if not specs_dir.is_dir():
        raise UserError(f"Specs directory not found: {specs_dir}")
    names = sorted(
        p.name
        for p in specs_dir.iterdir()
        if p.is_dir() and not p.name.startswith(".")
    )
    if not names:
        raise UserError(f"No feature directories under {specs_dir}")
    return names


def local_branch_exists(repo: Path, name: str) -> bool:
    r = run_git(
        ["show-ref", "--verify", "--quiet", f"refs/heads/{name}"],
        cwd=repo,
        check=False,
    )
    return r.returncode == 0


def remote_branch_ref(repo: Path, name: str) -> str | None:
    r = run_git(
        ["show-ref", "--verify", "--quiet", f"refs/remotes/origin/{name}"],
        cwd=repo,
        check=False,
    )
    if r.returncode == 0:
        return f"origin/{name}"
    return None


def valid_branch_name(repo: Path, name: str) -> bool:
    r = run_git(["check-ref-format", "--branch", name], cwd=repo, check=False)
    return r.returncode == 0


def worktree_map(repo: Path) -> dict[str, str]:
    """Map absolute worktree path -> branch name (empty if detached)."""
    mapping: dict[str, str] = {}
    path = ""
    branch = ""
    for line in git_out(["worktree", "list", "--porcelain"], cwd=repo).splitlines():
        if line.startswith("worktree "):
            if path:
                mapping[path] = branch
            path = str(Path(line.split(" ", 1)[1]).resolve())
            branch = ""
        elif line.startswith("branch "):
            ref = line.split(" ", 1)[1]
            branch = ref.removeprefix("refs/heads/")
        elif line == "detached":
            branch = ""
        elif line == "":
            if path:
                mapping[path] = branch
                path = ""
                branch = ""
    if path:
        mapping[path] = branch
    return mapping


def branch_checkout_path(wt_map: dict[str, str], branch: str) -> str | None:
    for path, name in wt_map.items():
        if name == branch:
            return path
    return None


def find_worktrees_json(worktree: Path, main: Path) -> Path | None:
    for base in (worktree, main):
        candidate = base / "worktrees.json"
        if candidate.is_file():
            return candidate
    return None


def select_setup(config: dict[str, Any]) -> Any | None:
    unix = os.name != "nt"
    primary = "setup-worktree-unix" if unix else "setup-worktree-windows"
    if primary in config:
        return config[primary]
    return config.get("setup-worktree")


def run_setup(worktree: Path, main: Path) -> str:
    config_path = find_worktrees_json(worktree, main)
    if config_path is None:
        return "setup skipped (no worktrees.json)"

    try:
        config = json.loads(config_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise UserError(f"Invalid JSON in {config_path}: {exc}") from exc

    if not isinstance(config, dict):
        raise UserError(f"{config_path} must be a JSON object")

    spec = select_setup(config)
    if spec is None:
        return "setup skipped (no setup-worktree* key)"

    env = os.environ.copy()
    env["ROOT_WORKTREE_PATH"] = str(main)

    if isinstance(spec, str):
        script = (config_path.parent / spec).resolve()
        if not script.is_file():
            raise UserError(f"Setup script not found: {script}")
        cmd = [str(script)] if os.access(script, os.X_OK) else ["bash", str(script)]
        proc = subprocess.run(cmd, cwd=worktree, env=env, text=True, capture_output=True)
        if proc.returncode != 0:
            detail = (proc.stderr or proc.stdout or "").strip()
            raise UserError(f"Setup script failed ({script}): {detail}")
        return f"setup ok (script {script.name})"

    if isinstance(spec, list):
        for i, command in enumerate(spec, start=1):
            if not isinstance(command, str):
                raise UserError(f"setup-worktree commands must be strings (item {i})")
            proc = subprocess.run(
                ["bash", "-c", command],
                cwd=worktree,
                env=env,
                text=True,
                capture_output=True,
            )
            if proc.returncode != 0:
                detail = (proc.stderr or proc.stdout or "").strip()
                raise UserError(f"Setup command {i} failed (`{command}`): {detail}")
        return f"setup ok ({len(spec)} command(s))"

    raise UserError(
        "setup-worktree* must be a command array or a script path relative to worktrees.json"
    )


def create_worktree(
    repo: Path,
    feature: str,
    dest: Path,
    *,
    dry_run: bool,
) -> tuple[str, bool]:
    """Return (status, created). created=True means setup should run."""
    if not valid_branch_name(repo, feature):
        return f"error: invalid branch name {feature!r}", False

    wt_map = worktree_map(repo)
    dest_key = str(dest.resolve())
    existing_for_branch = branch_checkout_path(wt_map, feature)

    if dest.exists():
        mapped_branch = wt_map.get(dest_key)
        if mapped_branch is not None:
            return f"skipped (worktree already at {dest_key})", False
        return f"error: path exists and is not a worktree: {dest}", False

    if existing_for_branch:
        return f"skipped (branch already checked out at {existing_for_branch})", False

    has_local = local_branch_exists(repo, feature)
    remote_ref = None if has_local else remote_branch_ref(repo, feature)

    if dry_run:
        if has_local:
            return f"dry-run: worktree add {dest} {feature} (existing branch)", False
        if remote_ref:
            return f"dry-run: worktree add -b {feature} {dest} {remote_ref}", False
        return f"dry-run: worktree add -b {feature} {dest} (new branch from HEAD)", False

    if has_local:
        cmd = ["worktree", "add", str(dest), feature]
        action = f"created at {dest} (existing branch)"
    elif remote_ref:
        cmd = ["worktree", "add", "-b", feature, str(dest), remote_ref]
        action = f"created at {dest} (from {remote_ref})"
    else:
        cmd = ["worktree", "add", "-b", feature, str(dest)]
        action = f"created at {dest} (new branch from HEAD)"

    try:
        run_git(cmd, cwd=repo)
    except subprocess.CalledProcessError as exc:
        err = (exc.stderr or exc.stdout or str(exc)).strip()
        return f"error: git worktree add failed: {err}", False

    return action, True


def parse_args(argv: list[str]) -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Create ../{feature} worktrees for docs/specs/{feature} directories."
    )
    p.add_argument(
        "features",
        nargs="*",
        help="Feature directory names to create. Default: every docs/specs/* directory.",
    )
    p.add_argument(
        "--specs-dir",
        default="docs/specs",
        help="Feature inventory relative to the main repo (default: docs/specs)",
    )
    p.add_argument(
        "--dry-run",
        action="store_true",
        help="Print planned git worktree add commands without creating anything.",
    )
    p.add_argument(
        "--skip-setup",
        action="store_true",
        help="Create worktrees only; do not run worktrees.json setup.",
    )
    return p.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv if argv is not None else sys.argv[1:])
    try:
        main_repo = discover_main_repo()
        specs_dir = (main_repo / args.specs_dir).resolve()
        available = list_features(specs_dir)
        parent = main_repo.parent

        if args.features:
            unknown = [f for f in args.features if f not in available]
            if unknown:
                raise UserError(
                    "Unknown feature(s): "
                    + ", ".join(unknown)
                    + f". Known: {', '.join(available)}"
                )
            selected = args.features
        else:
            selected = available

        print(f"main:    {main_repo}")
        print(f"specs:   {specs_dir}")
        print(f"parent:  {parent}")
        print(f"count:   {len(selected)}")
        print()

        failures = 0
        for feature in selected:
            dest = parent / feature
            status, created = create_worktree(
                main_repo, feature, dest, dry_run=args.dry_run
            )
            if status.startswith("error:"):
                failures += 1
                print(f"{feature}: {status}")
                continue
            if created and not args.skip_setup and not args.dry_run:
                try:
                    setup_status = run_setup(dest, main_repo)
                    print(f"{feature}: {status}; {setup_status}")
                except UserError as exc:
                    failures += 1
                    print(f"{feature}: {status}; setup error: {exc}")
            else:
                print(f"{feature}: {status}")

        return 1 if failures else 0
    except UserError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2
    except subprocess.CalledProcessError as exc:
        err = (exc.stderr or exc.stdout or str(exc)).strip()
        print(f"error: git failed: {err}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
