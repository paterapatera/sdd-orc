#!/usr/bin/env python3
"""tasks.md の形式と、同じディレクトリの design.md との対応を検証する。

使い方:
    python3 validate_tasks.py <tasks.md> [--target ready] [--design <design.md>]

--target を省略した場合は front matter の status を基準に検査する。
--design を省略した場合は、tasks.md と同じディレクトリの design.md を使う。
エラーが1件以上あれば終了コード1を返す。標準ライブラリのみ使用。
"""

import argparse
import re
import sys
from pathlib import Path

STATUSES = ["drafting", "ready"]
TASK_STATES = ["todo", "done"]
SLUG = r"[a-z0-9]+(?:-[a-z0-9]+)*"
REQ_ID_RE = re.compile(rf"^{SLUG}\.{SLUG}$")
AC_ID_RE = re.compile(rf"^{SLUG}\.{SLUG}\.ac\d+$")
D_ID_RE = re.compile(r"^D-\d+$")
PREFIXED_RE = re.compile(rf"^(decision|adr):({SLUG})$")
TASK_HEAD_RE = re.compile(rf"^T-(\d{{2,}}) ({SLUG}) (.+)（(新規|変更|削除)）$")
TASK_REF_RE = re.compile(r"^T-\d{2,}$")
COMPONENT_RE = re.compile(rf"^({SLUG}) (.+)（(新規|変更|削除)）$")
MAPPING_RE = re.compile(rf"^- ({SLUG}\.{SLUG}\.ac\d+):\s*(.+?)\s*/\s*検証:\s*(.+)$")
BASIS_RE = re.compile(r"（根拠:\s*([^）]+)）\s*$")
TEST_LINE_RE = re.compile(r"^\s+- (自動テスト（(?:単体|結合|E2E)）) (\S+?):\s*(.+)$")
MANUAL_RE = re.compile(rf"^({SLUG}\.{SLUG}\.ac\d+)\s*[:：]\s*(.+)$")
COMMAND_RE = re.compile(r"`[^`]+`")
TASK_FIELDS = ["依存", "場所", "守る技術判断", "テストを書く", "実装する", "完了条件", "状態"]
MANUAL = "手動確認"


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
        return None, 0
    for i in range(1, len(lines)):
        if lines[i].strip() == "---":
            fm = {}
            for raw in lines[1:i]:
                line = re.split(r"\s+#", raw, maxsplit=1)[0].rstrip()
                if ":" not in line:
                    continue
                key, value = line.split(":", 1)
                fm[key.strip()] = value.strip()
            return fm, i + 1
    return None, 0


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
    """「- <name>:」の行に続く、字下げされた行を返す。"""
    children = []
    inside = False
    for line in body:
        if line.startswith(f"- {name}:"):
            inside = True
            continue
        if inside:
            if line.startswith("  ") and line.strip():
                children.append(line)
            elif line.strip():
                break
    return children


def split_tokens(text):
    return [t.strip() for t in text.split(",") if t.strip()]


def basis_tokens(line):
    m = BASIS_RE.search(line)
    return split_tokens(m.group(1)) if m else []


def has_items(items):
    return any(not l.startswith("- なし") for l in items)


def parse_design(path):
    lines = path.read_text(encoding="utf-8").splitlines()
    fm, start = parse_front_matter(lines)
    sections = dict(split_sections(lines[start:], "## "))
    components = {}
    for heading, body in split_sections(sections.get("変更内容", []), "### "):
        m = COMPONENT_RE.match(heading)
        if not m:
            continue
        behaviors = [basis_tokens(b) for b in get_fields(body, "決めておく振る舞い")]
        components[m.group(1)] = {
            "name": m.group(2),
            "kind": m.group(3),
            "location": get_field(body, "場所") or "",
            "behaviors": [b for b in behaviors if b],
        }
    mapping = {}
    for line in sections.get("受け入れ条件との対応", []):
        m = MAPPING_RE.match(line)
        if m:
            mapping[m.group(1)] = {
                "components": split_tokens(m.group(2)),
                "verify": m.group(3).strip(),
            }
    decisions = {}
    for heading, body in split_sections(sections.get("技術判断", []), "### "):
        d_id = heading.split(maxsplit=1)[0] if heading else ""
        if D_ID_RE.match(d_id):
            decisions[d_id] = get_field(body, "状態") or ""
    data_items = [l for l in sections.get("データ", []) if l.startswith("- ")]
    release_items = [l for l in sections.get("移行・リリース", []) if l.startswith("- ")]
    return {
        "fm": fm or {},
        "components": components,
        "mapping": mapping,
        "decisions": decisions,
        "has_data": has_items(data_items),
        "has_release": has_items(release_items),
    }


def parse_requirement_ids(path):
    if not path.is_file():
        return None
    lines = path.read_text(encoding="utf-8").splitlines()
    _, start = parse_front_matter(lines)
    sections = dict(split_sections(lines[start:], "## "))
    ids = set()
    for heading, _ in split_sections(sections.get("要件", []), "### "):
        req_id = heading.split(maxsplit=1)[0] if heading else ""
        if REQ_ID_RE.match(req_id):
            ids.add(req_id)
    return ids


def find_root(path):
    p = Path(path).resolve()
    if len(p.parents) < 4:
        return None
    if p.parents[1].name == "specs" and p.parents[2].name == "docs":
        return p.parents[3]
    return None


def check_token(token, where, design, req_ids, root, report):
    pm = PREFIXED_RE.match(token)
    if AC_ID_RE.match(token):
        if token not in design["mapping"]:
            report.error(f"{where} の根拠 {token} が design.md の「受け入れ条件との対応」にありません。")
    elif REQ_ID_RE.match(token):
        if req_ids is not None and token not in req_ids:
            report.error(f"{where} の根拠 {token} が requirements.md にありません。")
    elif D_ID_RE.match(token):
        if token not in design["decisions"]:
            report.error(f"{where} の根拠 {token} が design.md の技術判断にありません。")
    elif pm:
        folder = "decisions" if pm.group(1) == "decision" else "adr"
        if root is not None and not (root / "docs" / folder / f"{pm.group(2)}.md").is_file():
            report.error(f"{where} の根拠 {token} が docs/{folder} にありません。")
    else:
        report.error(f"{where} の根拠「{token}」は使えません。受け入れ条件ID、要件ID、D-xx、adr:<id>、decision:<id> のいずれかを書いてください。")


def check(path, target, design_path):
    report = Report()
    lines = path.read_text(encoding="utf-8").splitlines()
    root = find_root(path)

    fm, start = parse_front_matter(lines)
    if fm is None:
        report.error("YAML front matter（先頭の --- で囲まれた部分）がありません。")
        return report, target or "drafting"
    for key in ["feature", "status"]:
        if not fm.get(key):
            report.error(f"front matter に {key} がありません。")
    status = fm.get("status", "")
    if status and status not in STATUSES:
        report.error(f"status「{status}」は無効です。使える値: {', '.join(STATUSES)}")
    if root is not None and fm.get("feature") and fm.get("feature") != path.parent.name:
        report.error(f"feature「{fm.get('feature')}」がディレクトリ名「{path.parent.name}」と一致しません。")
    effective = target or (status if status in STATUSES else "drafting")

    design_path = design_path or path.parent / "design.md"
    if not design_path.is_file():
        report.error(f"design.md がありません（{design_path}）。")
        return report, effective
    design = parse_design(design_path)
    if design["fm"].get("status") != "approved":
        report.error(f"design.md が approved ではありません（status: {design['fm'].get('status', '')}）。sdd-design で承認を済ませてください。")
    if fm.get("feature") and design["fm"].get("feature") and fm.get("feature") != design["fm"].get("feature"):
        report.error(f"feature が design.md（{design['fm'].get('feature')}）と一致しません。")
    req_ids = parse_requirement_ids(design_path.parent / "requirements.md")

    tasks = []
    for heading, body in split_sections(lines[start:], "## "):
        m = TASK_HEAD_RE.match(heading)
        if not m:
            report.error(f"タスクの見出し「{heading}」の形式が違います。「T-01 <コンポーネントID> <名前>（新規|変更|削除）」で書いてください。")
            continue
        tasks.append((f"T-{m.group(1)}", m.group(2), m.group(3), m.group(4), body))
    if not tasks:
        report.error("タスクがありません。")

    order = {}
    for index, (task_id, *_rest) in enumerate(tasks, start=1):
        expected = f"T-{index:02d}"
        if task_id != expected:
            report.error(f"タスク番号 {task_id} が連番ではありません（{expected} のはずです）。")
        order.setdefault(task_id, index)

    task_of_component = {}
    deps_of = {}
    ac_placed = {}
    implement_texts = []
    for task_id, comp_id, name, kind, body in tasks:
        where = f"{task_id}"
        for key in TASK_FIELDS:
            if get_field(body, key) is None:
                report.error(f"{where} に「{key}」がありません。")

        comp = design["components"].get(comp_id)
        if comp is None:
            report.error(f"{where} のコンポーネント {comp_id} が design.md の「変更内容」にありません。")
        else:
            if comp_id in task_of_component:
                report.error(f"コンポーネント {comp_id} が {task_of_component[comp_id]} と {task_id} の2つのタスクにあります。1つにまとめてください。")
            task_of_component.setdefault(comp_id, task_id)
            if kind != comp["kind"]:
                report.error(f"{where} の種類（{kind}）が design.md の {comp_id}（{comp['kind']}）と違います。")
            location = get_field(body, "場所")
            if location is not None and location != comp["location"]:
                report.error(f"{where} の場所「{location}」が design.md の {comp_id} の場所「{comp['location']}」と違います。")

        deps_raw = get_field(body, "依存") or ""
        deps = [] if deps_raw in ("", "なし") else split_tokens(deps_raw)
        for dep in deps:
            if not TASK_REF_RE.match(dep):
                report.error(f"{where} の依存「{dep}」の形式が違います。T-01 の形か「なし」で書いてください。")
            elif dep not in order:
                report.error(f"{where} の依存 {dep} というタスクがありません。")
            elif order[dep] >= order.get(task_id, 0):
                report.error(f"{where} の依存 {dep} が {task_id} より後ろにあります。依存先のタスクを前に置いてください。")
        deps_of[task_id] = [d for d in deps if d in order]

        guards_raw = get_field(body, "守る技術判断") or ""
        guards = set() if guards_raw in ("", "なし") else set(split_tokens(guards_raw))
        for token in guards:
            check_token(token, f"{where} の守る技術判断", design, req_ids, root, report)
        if comp is not None:
            needed = {t for b in comp["behaviors"] for t in b if D_ID_RE.match(t) or PREFIXED_RE.match(t)}
            missing = sorted(needed - guards)
            if missing:
                report.error(f"{where} の守る技術判断に {', '.join(missing)} がありません（design.md の {comp_id} の決めておく振る舞いの根拠）。")

        tests_raw = get_field(body, "テストを書く")
        test_lines = field_children(body, "テストを書く")
        covered = set()
        if tests_raw is not None and tests_raw.startswith("なし"):
            if not re.match(r"^なし（.+）$", tests_raw):
                report.error(f"{where} のテストを書くが「なし」のときは、「なし（<理由>）」と理由を書いてください。")
            if test_lines:
                report.error(f"{where} のテストを書くが「なし」なのに、テストの行があります。")
        elif tests_raw is not None:
            if tests_raw:
                report.error(f"{where} のテストを書くは、次の行から字下げして1行ずつ書いてください。")
            if not test_lines:
                report.error(f"{where} にテストの行がありません。ない場合は「なし（<理由>）」と書いてください。")
        for line in test_lines:
            tm = TEST_LINE_RE.match(line)
            if not tm:
                report.error(f"{where} のテストの行「{line.strip()[:40]}」の形式が違います。「- 自動テスト（単体|結合|E2E） <パス>: <確かめること>（根拠: ...）」で書いてください。")
                continue
            verify = tm.group(1)
            tokens = basis_tokens(line)
            if not tokens:
                report.error(f"{where} のテストの行「{line.strip()[:40]}」に（根拠: ...）がありません。")
            for token in tokens:
                check_token(token, f"{where} のテスト", design, req_ids, root, report)
                covered.add(token)
                if AC_ID_RE.match(token):
                    ac_placed.setdefault(token, []).append((task_id, verify))
        for review in get_fields(body, "レビューで確かめる"):
            tokens = basis_tokens(review)
            if not tokens:
                report.error(f"{where} のレビューで確かめる「{review[:40]}」に（根拠: ...）がありません。")
            for token in tokens:
                check_token(token, f"{where} のレビューで確かめる", design, req_ids, root, report)
                covered.add(token)
        for manual in get_fields(body, MANUAL):
            mm = MANUAL_RE.match(manual)
            if not mm:
                report.error(f"{where} の手動確認「{manual[:40]}」の形式が違います。「<受け入れ条件ID>: <確かめること>」で書いてください。")
                continue
            ac_placed.setdefault(mm.group(1), []).append((task_id, MANUAL))
            check_token(mm.group(1), f"{where} の手動確認", design, req_ids, root, report)

        if comp is not None:
            for behavior in comp["behaviors"]:
                if not set(behavior) & covered:
                    report.warn(f"{where}: design.md の {comp_id} の決めておく振る舞い（根拠: {', '.join(behavior)}）を確かめるテストか「レビューで確かめる」がありません。")

        implement = get_field(body, "実装する") or ""
        implement_texts.append(implement)
        if implement and comp_id not in implement:
            report.error(f"{where} の実装するに、コンポーネントID {comp_id} がありません。")

        done_when = get_field(body, "完了条件") or ""
        if done_when and not COMMAND_RE.search(done_when):
            report.error(f"{where} の完了条件に、テストの実行コマンド（`...`）がありません。")
        if any("E2E" in l for l in test_lines) and done_when and len(COMMAND_RE.findall(done_when)) < 2 and "e2e" not in done_when.lower():
            report.warn(f"{where} にE2Eのテストがありますが、完了条件にE2Eの実行コマンドが見当たりません。")

        state = get_field(body, "状態")
        if state is not None and state not in TASK_STATES:
            report.error(f"{where} の状態「{state}」は無効です。使える値: {', '.join(TASK_STATES)}")

    for comp_id in design["components"]:
        if comp_id not in task_of_component:
            report.error(f"design.md のコンポーネント {comp_id} が、どのタスクにもありません。")

    def ancestors(task_id, seen=None):
        seen = set() if seen is None else seen
        for dep in deps_of.get(task_id, []):
            if dep not in seen:
                seen.add(dep)
                ancestors(dep, seen)
        return seen

    for ac_id, info in design["mapping"].items():
        placed = ac_placed.get(ac_id, [])
        if not placed:
            where = "手動確認" if info["verify"] == MANUAL else "テストを書く"
            report.error(f"受け入れ条件 {ac_id}（{info['verify']}）が、どのタスクの「{where}」にもありません。")
            continue
        verifies = {v for _, v in placed}
        if info["verify"] not in verifies:
            report.error(f"受け入れ条件 {ac_id} の検証方法が design.md（{info['verify']}）と違います（tasks.md: {', '.join(sorted(verifies))}）。")
        for task_id, verify in placed:
            if verify != info["verify"]:
                continue
            available = ancestors(task_id) | {task_id}
            for comp_id in info["components"]:
                comp_task = task_of_component.get(comp_id)
                if comp_task and comp_task not in available:
                    report.error(f"受け入れ条件 {ac_id} を {task_id} に置いていますが、必要なコンポーネント {comp_id}（{comp_task}）が {task_id} の依存にありません。")

    all_implement = "\n".join(implement_texts)
    if design["has_data"] and "データ" not in all_implement:
        report.warn("design.md の「データ」の項目が、どのタスクの「実装する」にも書かれていません。")
    if design["has_release"] and "移行・リリース" not in all_implement:
        report.warn("design.md の「移行・リリース」の項目が、どのタスクの「実装する」にも書かれていません。")

    return report, effective


def main():
    parser = argparse.ArgumentParser(description="tasks.md を検証する")
    parser.add_argument("path", type=Path)
    parser.add_argument("--target", choices=STATUSES, help="この status に進める状態かを検査する")
    parser.add_argument("--design", type=Path, help="対応する design.md（省略時は同じディレクトリ）")
    args = parser.parse_args()

    if not args.path.is_file():
        print(f"ファイルが見つかりません: {args.path}", file=sys.stderr)
        return 2

    report, effective = check(args.path, args.target, args.design)
    for msg in report.errors:
        print(f"ERROR: {msg}")
    for msg in report.warnings:
        print(f"WARN: {msg}")
    print(f"結果（検査基準: {effective}）: エラー {len(report.errors)} 件 / 警告 {len(report.warnings)} 件")
    return 1 if report.errors else 0


if __name__ == "__main__":
    sys.exit(main())
