#!/usr/bin/env python3
"""後片付け（要件の取り込み）の前提と結果を検証する。

使い方:
    python3 check_finalize.py <docs/specs/<feature>/requirements.md> [--before]

--before: 取り込む前の検査。変更・削除する要件が docs/capabilities/ にあり、
          「現行」の行が今の要件文と一致するか、追加する要件がまだないかを確かめる。
省略時:   取り込んだ後の検査。docs/capabilities/、docs/glossary.md、ADR の状態を確かめる。

どちらも、requirements.md と design.md が approved で、tasks.md の全タスクが done であることを確かめる。
エラーが1件以上あれば終了コード1を返す。標準ライブラリのみ使用。
"""

import argparse
import re
import sys
from pathlib import Path

SLUG = r"[a-z0-9]+(?:-[a-z0-9]+)*"
REQ_ID_RE = re.compile(rf"^{SLUG}\.{SLUG}$")
D_ID_RE = re.compile(r"^D-\d+$")
BASIS_RE = re.compile(r"（根拠:\s*([^）]+)）\s*$")
TERM_RE = re.compile(r"^- ([^:：]+)[:：]\s*(.*)$")
REGISTRY_RE = re.compile(rf"^- ({SLUG}):\s*(.*)$")
CURRENT_RE = re.compile(r"^\s+- 現行:\s*(.*)$")
QUESTION_RE = re.compile(r"\bQ-\d+\b")
NEW_MARK = "（新規）"
CAPABILITY_FIELDS = ["種別", "要件", "解釈", "根拠", "受け入れ条件"]


class Report:
    def __init__(self):
        self.errors = []
        self.warnings = []

    def error(self, msg):
        self.errors.append(msg)

    def warn(self, msg):
        self.warnings.append(msg)


def parse_front_matter(lines):
    if not lines or lines[0].strip() != "---":
        return {}, 0
    for i in range(1, len(lines)):
        if lines[i].strip() == "---":
            fm = {}
            for raw in lines[1:i]:
                line = re.split(r"\s+#", raw, maxsplit=1)[0].rstrip()
                if ":" in line:
                    key, value = line.split(":", 1)
                    fm[key.strip()] = value.strip()
            return fm, i + 1
    return {}, 0


def split_sections(lines, prefix):
    sections = []
    current = None
    for line in lines:
        if line.startswith(prefix):
            current = (line[len(prefix):].strip(), [])
            sections.append(current)
        elif current is not None:
            current[1].append(line)
    return sections


def get_fields(body, name):
    pattern = re.compile(rf"^- {re.escape(name)}:\s*(.*)$")
    return [m.group(1).strip() for m in (pattern.match(l) for l in body) if m]


def get_field(body, name):
    values = get_fields(body, name)
    return values[0] if values else None


def field_children(body, name):
    children = []
    inside = False
    for line in body:
        if line.startswith(f"- {name}:"):
            inside = True
            continue
        if inside:
            if line.startswith("  ") and line.strip():
                children.append(line.rstrip())
            elif line.strip():
                break
    return children


def normalize(text):
    return re.sub(r"\s+", " ", (text or "").strip())


def read_doc(path):
    lines = path.read_text(encoding="utf-8").splitlines()
    fm, start = parse_front_matter(lines)
    return fm, dict(split_sections(lines[start:], "## ")), lines[start:]


def parse_requirement(heading, body):
    parts = heading.split(maxsplit=1)
    return {
        "id": parts[0] if parts else "",
        "title": parts[1] if len(parts) > 1 else "",
        "fields": {name: get_fields(body, name) for name in CAPABILITY_FIELDS},
        "acs": field_children(body, "受け入れ条件"),
        "body": body,
    }


def parse_requirements_doc(path):
    fm, sections, _ = read_doc(path)
    requirements = {}
    for heading, body in split_sections(sections.get("要件", []), "### "):
        req = parse_requirement(heading, body)
        if REQ_ID_RE.match(req["id"]):
            requirements[req["id"]] = req
    impact = {}
    for name, body in split_sections(sections.get("既存仕様への影響", []), "### "):
        items = []
        for i, line in enumerate(body):
            if not line.startswith("- ") or line.startswith("- なし"):
                continue
            req_id = line[2:].split(":", 1)[0].strip()
            current = None
            if i + 1 < len(body):
                m = CURRENT_RE.match(body[i + 1])
                if m:
                    current = m.group(1).strip()
            items.append((req_id, current))
        impact[name] = items
    terms = {}
    for line in sections.get("用語", []):
        m = TERM_RE.match(line)
        if m and m.group(2).rstrip().endswith(NEW_MARK):
            terms[m.group(1).strip()] = m.group(2).rstrip()[: -len(NEW_MARK)].strip()
    return fm, requirements, impact, terms


def parse_design(path):
    fm, sections, _ = read_doc(path)
    interpretations = {}
    for heading, body in split_sections(sections.get("技術判断", []), "### "):
        d_id = heading.split(maxsplit=1)[0] if heading else ""
        if D_ID_RE.match(d_id) and get_field(body, "種類") == "要件の解釈" and get_field(body, "状態") == "decided":
            interpretations[d_id] = set()
    for line in sections.get("変更内容", []):
        m = BASIS_RE.search(line)
        if not m:
            continue
        tokens = [t.strip() for t in m.group(1).split(",")]
        req_ids = {t for t in tokens if REQ_ID_RE.match(t)}
        for t in tokens:
            if t in interpretations:
                interpretations[t] |= req_ids
    return fm, interpretations


def parse_tasks(path):
    fm, _, lines = read_doc(path)
    states = []
    for heading, body in split_sections(lines, "## "):
        if heading.startswith("T-"):
            states.append((heading.split(maxsplit=1)[0], get_field(body, "状態")))
    return fm, states


def parse_capabilities(root):
    cap_dir = root / "docs" / "capabilities"
    found = {}
    files = {}
    if not cap_dir.is_dir():
        return found, files
    for f in sorted(cap_dir.glob("*.md")):
        if f.name == "README.md":
            continue
        lines = f.read_text(encoding="utf-8").splitlines()
        files[f.stem] = lines
        for heading, body in split_sections(lines, "### "):
            req = parse_requirement(heading, body)
            if REQ_ID_RE.match(req["id"]):
                found.setdefault(req["id"], []).append((f.stem, req))
    return found, files


def parse_registry(root):
    path = root / "docs" / "capabilities" / "README.md"
    registry = {}
    if path.is_file():
        for line in path.read_text(encoding="utf-8").splitlines():
            m = REGISTRY_RE.match(line)
            if m:
                registry[m.group(1)] = m.group(2).strip()
    return registry


def check_statuses(req_fm, spec_dir, report):
    if req_fm.get("status") != "approved":
        report.error(f"requirements.md の status が approved ではありません（{req_fm.get('status')}）。")
    design = spec_dir / "design.md"
    tasks = spec_dir / "tasks.md"
    interpretations = {}
    if not design.is_file():
        report.error("design.md がありません。")
    else:
        design_fm, interpretations = parse_design(design)
        if design_fm.get("status") != "approved":
            report.error(f"design.md の status が approved ではありません（{design_fm.get('status')}）。")
    if not tasks.is_file():
        report.error("tasks.md がありません。")
    else:
        tasks_fm, states = parse_tasks(tasks)
        if tasks_fm.get("status") != "ready":
            report.error(f"tasks.md の status が ready ではありません（{tasks_fm.get('status')}）。")
        if not states:
            report.error("tasks.md にタスクがありません。")
        for task_id, state in states:
            if state != "done":
                report.error(f"{task_id} の状態が done ではありません（{state}）。")
    return interpretations


def check_before(impact, capabilities, report):
    for req_id, _ in impact.get("追加", []):
        if req_id in capabilities:
            report.error(f"追加する {req_id} が、すでに docs/capabilities/ にあります。")
    for req_id, current in impact.get("変更", []):
        entries = capabilities.get(req_id, [])
        if not entries:
            report.error(f"変更する {req_id} が docs/capabilities/ にありません。依存先がまだ取り込まれていない可能性があります。")
            continue
        now = entries[0][1]["fields"]["要件"]
        if current is None:
            report.error(f"変更する {req_id} に「現行」の行がありません。")
        elif normalize(current) != normalize(now[0] if now else ""):
            report.error(f"変更する {req_id} の「現行」が今の要件文と一致しません。他の機能が先に変えた可能性があります。今: {now[0] if now else '(なし)'}")
    for req_id, _ in impact.get("削除", []):
        if req_id not in capabilities:
            report.error(f"削除する {req_id} が docs/capabilities/ にありません。")


def check_after(root, fm, requirements, impact, terms, interpretations, report):
    capabilities, files = parse_capabilities(root)
    registry = parse_registry(root)
    issue = fm.get("issue", "")
    feature = fm.get("feature", "")
    targets = [r for r, _ in impact.get("追加", [])] + [r for r, _ in impact.get("変更", [])]

    for req_id in targets:
        src = requirements.get(req_id)
        if src is None:
            report.error(f"既存仕様への影響の {req_id} が、requirements.md の本文にありません。")
            continue
        entries = capabilities.get(req_id, [])
        if len(entries) != 1:
            report.error(f"{req_id} が docs/capabilities/ に {len(entries)} 件あります。1件にしてください。")
            continue
        cap, dst = entries[0]
        expected_cap = req_id.split(".", 1)[0]
        if cap != expected_cap:
            report.error(f"{req_id} が docs/capabilities/{cap}.md にあります。{expected_cap}.md に置いてください。")
        if normalize(dst["title"]) != normalize(src["title"]):
            report.error(f"{req_id} の見出しが requirements.md と違います。")
        for name in ["種別", "要件"]:
            if [normalize(v) for v in dst["fields"][name]] != [normalize(v) for v in src["fields"][name]]:
                report.error(f"{req_id} の「{name}」が requirements.md と違います。1文字も変えずに書き写してください。")
        if [normalize(l) for l in dst["acs"]] != [normalize(l) for l in src["acs"]]:
            report.error(f"{req_id} の受け入れ条件が requirements.md と違います。")
        basis = " ".join(dst["fields"]["根拠"])
        if f"#{issue}" not in re.findall(r"#\d+", basis):
            report.error(f"{req_id} の根拠に #{issue} がありません。")
        if QUESTION_RE.search(basis):
            report.error(f"{req_id} の根拠に質問ID（Q-xx）が残っています。issue番号に置き換えてください。")
        for line in dst["body"]:
            m = re.match(r"^- ([^:：]+)[:：]", line)
            if m and m.group(1) not in CAPABILITY_FIELDS:
                report.warn(f"{req_id} に、取り込みの形式にない項目「{m.group(1)}」があります。")

    for d_id, req_ids in sorted(interpretations.items()):
        related = [r for r in sorted(req_ids) if r in targets]
        if not related:
            report.warn(f"要件の解釈 {d_id} に関係する、この機能の要件が見つかりません。反映先を確かめてください。")
            continue
        for req_id in related:
            entries = capabilities.get(req_id, [])
            if entries and not entries[0][1]["fields"]["解釈"]:
                report.error(f"要件の解釈 {d_id} が、{req_id} の「解釈」に反映されていません。")

    for req_id, _ in impact.get("削除", []):
        if req_id in capabilities:
            report.error(f"削除する {req_id} が、docs/capabilities/ に残っています。")

    for cap, lines in files.items():
        if cap not in registry:
            report.error(f"docs/capabilities/{cap}.md の業務領域が README.md の一覧にありません。")
            continue
        head = lines[0].strip() if lines else ""
        if head != f"# {cap}: {registry[cap]}":
            report.warn(f"docs/capabilities/{cap}.md の1行目が「# {cap}: {registry[cap]}」ではありません。")

    glossary_path = root / "docs" / "glossary.md"
    glossary = {}
    if glossary_path.is_file():
        for line in glossary_path.read_text(encoding="utf-8").splitlines():
            m = TERM_RE.match(line)
            if m:
                glossary[m.group(1).strip()] = m.group(2).strip()
    for term, definition in terms.items():
        if term not in glossary:
            report.error(f"新規の用語「{term}」が docs/glossary.md にありません。")
        elif normalize(glossary[term]) != normalize(definition):
            report.error(f"用語「{term}」の定義が docs/glossary.md と requirements.md で違います。")
        elif glossary[term].endswith(NEW_MARK):
            report.error(f"docs/glossary.md の用語「{term}」に「（新規）」が残っています。")

    adr_dir = root / "docs" / "adr"
    if adr_dir.is_dir():
        for f in sorted(adr_dir.glob("*.md")):
            adr_fm, _ = parse_front_matter(f.read_text(encoding="utf-8").splitlines())
            if adr_fm.get("feature") == feature and adr_fm.get("status") not in ("accepted", "superseded"):
                report.error(f"この機能のADR {f.name} が accepted ではありません（{adr_fm.get('status')}）。")


def main():
    parser = argparse.ArgumentParser(description="後片付けの前提と結果を検証する")
    parser.add_argument("requirements", help="docs/specs/<feature>/requirements.md のパス")
    parser.add_argument("--before", action="store_true", help="取り込む前の検査をする")
    args = parser.parse_args()

    path = Path(args.requirements).resolve()
    if path.name != "requirements.md" or not path.is_file():
        print(f"requirements.md が見つかりません: {path}", file=sys.stderr)
        return 2
    spec_dir = path.parent
    root = spec_dir.parents[2]
    if not (root / "docs" / "specs").is_dir():
        print(f"docs/specs/<feature>/requirements.md のパスを指定してください: {path}", file=sys.stderr)
        return 2

    report = Report()
    fm, requirements, impact, terms = parse_requirements_doc(path)
    if fm.get("feature") != spec_dir.name:
        report.error(f"front matter の feature（{fm.get('feature')}）がディレクトリ名（{spec_dir.name}）と違います。")
    interpretations = check_statuses(fm, spec_dir, report)

    if args.before:
        capabilities, _ = parse_capabilities(root)
        check_before(impact, capabilities, report)
    else:
        check_after(root, fm, requirements, impact, terms, interpretations, report)

    label = "取り込む前" if args.before else "取り込んだ後"
    print(f"# 後片付けの検証（{label}）: {spec_dir.name}")
    for msg in report.errors:
        print(f"エラー: {msg}")
    for msg in report.warnings:
        print(f"警告: {msg}")
    print(f"エラー {len(report.errors)} 件、警告 {len(report.warnings)} 件")
    return 1 if report.errors else 0


if __name__ == "__main__":
    sys.exit(main())
