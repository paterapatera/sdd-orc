#!/usr/bin/env python3
"""Check skill frontmatter and local rule paths."""

import re
import sys
from pathlib import Path

try:
    import yaml
except ImportError:
    sys.exit("PyYAML is required")

ROOT = Path(__file__).resolve().parents[1] / ".agents" / "skills"
RULE_RE = re.compile(r"(?<![\w./-])((?:\.\./sdd-[a-z0-9-]+/)?rules/[A-Za-z0-9_./-]+\.md)")
SHARED_RE = re.compile(r"\.\./sdd-validate-shared/[A-Za-z0-9_./-]+\.md")
FORBIDDEN = (".kiro/", "per-task reviewer", "improvement 08", "+ex+", "bun run verify")


def main() -> int:
    errors: list[str] = []
    skills = sorted(ROOT.glob("*/SKILL.md"))
    if not skills:
        print(f"no skills under {ROOT}", file=sys.stderr)
        return 1

    for skill in skills:
        text = skill.read_text()
        if not text.startswith("---\n"):
            errors.append(f"{skill}: missing frontmatter")
            continue
        end = text.find("\n---", 4)
        if end < 0:
            errors.append(f"{skill}: unclosed frontmatter")
            continue
        try:
            data = yaml.safe_load(text[4:end])
        except yaml.YAMLError as exc:
            errors.append(f"{skill}: YAML {exc}")
            continue
        if not isinstance(data, dict) or not data.get("name") or not data.get("description"):
            errors.append(f"{skill}: name and description are required")
            continue
        shared = (data.get("metadata") or {}).get("shared-rules") or ""
        for rel in [part.strip() for part in shared.split(",") if part.strip()]:
            candidates = [skill.parent / rel, skill.parent / "rules" / rel]
            if not any(path.resolve().is_file() for path in candidates):
                errors.append(f"{skill}: missing shared rule {rel}")
        for match in RULE_RE.findall(text) + SHARED_RE.findall(text):
            if not match.startswith("../") and not (skill.parent / "rules").is_dir():
                continue
            if not (skill.parent / match).resolve().is_file():
                errors.append(f"{skill}: missing {match}")

    for path in ROOT.rglob("*.md"):
        body = path.read_text()
        for token in FORBIDDEN:
            if token in body:
                errors.append(f"{path}: contains {token!r}")

    if errors:
        print("\n".join(errors), file=sys.stderr)
        return 1
    print(f"ok: {len(skills)} skills")
    return 0


if __name__ == "__main__":
    sys.exit(main())
