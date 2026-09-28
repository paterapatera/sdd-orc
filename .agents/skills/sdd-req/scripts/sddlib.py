"""sdd-req のスクリプトで共通に使う読み込み処理（標準ライブラリのみ）。"""

import re
import subprocess
from pathlib import Path

SLUG = r"[a-z0-9]+(?:-[a-z0-9]+)*"
SLUG_RE = re.compile(rf"^{SLUG}$")
REQ_ID_RE = re.compile(rf"^({SLUG})\.({SLUG})$")
DECISION_REF_RE = re.compile(rf"decision:({SLUG})")
TERM_RE = re.compile(r"^- ([^:：]+)[:：]\s*(.*)$")
REGISTRY_RE = re.compile(rf"^- ({SLUG}):\s*(.*)$")
CURRENT_RE = re.compile(r"^\s+- 現行:\s*(.*)$")
NEW_TERM_MARK = "（新規）"
TREE = "作業ツリー"

DOC_PATTERNS = [
    re.compile(r"^docs/specs/[^/]+/requirements\.md$"),
    re.compile(r"^docs/decisions/[^/]+\.md$"),
    re.compile(r"^docs/capabilities/README\.md$"),
]


def parse_front_matter(lines):
    if not lines or lines[0].strip() != "---":
        return None, 0
    for i in range(1, len(lines)):
        if lines[i].strip() == "---":
            fm = {}
            for raw in lines[1:i]:
                line = re.split(r"\s+#", raw, maxsplit=1)[0].rstrip()
                if ":" not in line:
                    continue
                key, value = line.split(":", 1)
                value = value.strip()
                if value.startswith("[") and value.endswith("]"):
                    value = [v.strip() for v in value[1:-1].split(",") if v.strip()]
                fm[key.strip()] = value
            return fm, i + 1
    return None, 0


def split_sections(lines, prefix):
    """prefix（"## " や "### "）で始まる見出しごとに (見出し, 本文行) を返す。"""
    sections = []
    current = None
    for line in lines:
        if line.startswith(prefix):
            current = (line[len(prefix):].strip(), [])
            sections.append(current)
        elif current is not None:
            current[1].append(line)
    return sections


def get_field(body, name):
    pattern = re.compile(rf"^- {re.escape(name)}:\s*(.*)$")
    for line in body:
        m = pattern.match(line)
        if m:
            return m.group(1).strip()
    return None


def normalize_text(text):
    return re.sub(r"\s+", "", text or "")


def find_root(path):
    """docs/specs/<feature>/requirements.md のリポジトリのルートを返す。それ以外の場所なら None。"""
    p = Path(path).resolve()
    if len(p.parents) < 4:
        return None
    if p.name == "requirements.md" and p.parents[1].name == "specs" and p.parents[2].name == "docs":
        return p.parents[3]
    return None


def git(root, *args):
    try:
        result = subprocess.run(
            ["git", "-C", str(root), *args], capture_output=True, text=True, timeout=60
        )
    except (OSError, subprocess.SubprocessError):
        return None
    return result.stdout if result.returncode == 0 else None


def remote_refs(root):
    out = git(root, "for-each-ref", "--format=%(refname)", "refs/remotes")
    if out is None:
        return None
    return [r for r in out.split() if not r.endswith("/HEAD")]


def ref_docs(root, ref):
    out = git(root, "ls-tree", "-r", "--name-only", ref, "--", "docs")
    files = {}
    for rel in (out or "").splitlines():
        if any(p.match(rel) for p in DOC_PATTERNS):
            text = git(root, "show", f"{ref}:{rel}")
            if text is not None:
                files[rel] = text
    return files


def tree_docs(root):
    files = {}
    for sub, pattern in [
        ("docs/specs", "*/requirements.md"),
        ("docs/decisions", "*.md"),
        ("docs/capabilities", "README.md"),
    ]:
        base = root / sub
        if base.is_dir():
            for f in sorted(base.glob(pattern)):
                files[f.relative_to(root).as_posix()] = f.read_text(encoding="utf-8")
    return files


def collect(root, scan_branches=True):
    """作業ツリーと、作業ツリーと内容が異なるリモートブランチのドキュメントを集める。

    戻り値は (entries, notes)。entries は (出どころ, パス, 内容) のリストで、
    出どころは TREE かリモートブランチ名（例: origin/feature-x）。
    """
    tree = tree_docs(root)
    entries = [(TREE, rel, text) for rel, text in tree.items()]
    notes = []
    if scan_branches:
        refs = remote_refs(root)
        if refs is None:
            notes.append("git のリモートブランチを読めなかったため、作業中ブランチの確認を省略しました。")
        else:
            seen = set()
            for ref in refs:
                for rel, text in ref_docs(root, ref).items():
                    if tree.get(rel) == text or (rel, text) in seen:
                        continue
                    seen.add((rel, text))
                    entries.append((ref.removeprefix("refs/remotes/"), rel, text))
    return entries, notes


def parse_spec(text):
    lines = text.splitlines()
    fm, start = parse_front_matter(lines)
    body = lines[start:]
    sections = dict(split_sections(body, "## "))

    requirements = {}
    for heading, r_body in split_sections(sections.get("要件", []), "### "):
        req_id = heading.split(maxsplit=1)[0] if heading else ""
        if REQ_ID_RE.match(req_id):
            requirements[req_id] = get_field(r_body, "要件") or ""

    impact = dict(split_sections(sections.get("既存仕様への影響", []), "### "))
    impact_ids = {}
    currents = {}
    for name in ["追加", "変更", "削除"]:
        ids = []
        last = None
        for line in impact.get(name, []):
            if line.startswith("- "):
                token = line[2:].split(":", 1)[0].strip()
                last = token if REQ_ID_RE.match(token) else None
                if last:
                    ids.append(last)
            elif last and name == "変更":
                m = CURRENT_RE.match(line)
                if m:
                    currents[last] = m.group(1).strip()
        impact_ids[name] = ids

    terms = {}
    for line in sections.get("用語", []):
        m = TERM_RE.match(line)
        if m:
            terms[m.group(1).strip()] = m.group(2).strip()

    return {
        "fm": fm or {},
        "requirements": requirements,
        "added": impact_ids["追加"],
        "changed": impact_ids["変更"],
        "removed": impact_ids["削除"],
        "currents": currents,
        "terms": terms,
        "decisions": set(DECISION_REF_RE.findall("\n".join(sections.get("要件", [])))),
    }


def parse_decision(text, rel=""):
    lines = text.splitlines()
    fm, start = parse_front_matter(lines)
    fm = fm or {}
    body = lines[start:]
    title = next((l[2:].strip() for l in body if l.startswith("# ")), "")
    return {
        "id": fm.get("id") or Path(rel).stem,
        "status": fm.get("status", ""),
        "feature": fm.get("feature", ""),
        "superseded_by": fm.get("superseded_by", ""),
        "title": title,
        "body": body,
    }


def parse_registry(text):
    registry = {}
    for line in text.splitlines():
        m = REGISTRY_RE.match(line)
        if m:
            registry[m.group(1)] = m.group(2).strip()
    return registry


def parse_glossary(text):
    terms = {}
    for line in text.splitlines():
        m = TERM_RE.match(line)
        if m:
            terms[m.group(1).strip()] = m.group(2).strip()
    return terms


def parse_capability_requirements(text):
    """docs/capabilities/<業務領域>.md から {要件ID: 要件文} を返す。"""
    requirements = {}
    for heading, body in split_sections(text.splitlines(), "### "):
        req_id = heading.split(maxsplit=1)[0] if heading else ""
        if REQ_ID_RE.match(req_id):
            requirements[req_id] = get_field(body, "要件") or ""
    return requirements


def existing_requirements(root):
    cap_dir = root / "docs" / "capabilities"
    requirements = {}
    if cap_dir.is_dir():
        for f in sorted(cap_dir.glob("*.md")):
            if f.name != "README.md":
                requirements.update(parse_capability_requirements(f.read_text(encoding="utf-8")))
    return requirements
