#!/usr/bin/env python3
"""design.md の形式と、同じディレクトリの requirements.md との対応を検証する。

使い方:
    python3 validate_design.py <design.md> [--target clarifying|approved]

--target を省略した場合は front matter の status を基準に検査する。
docs/specs/<feature>/design.md にあるファイルは、既存コードのパスと docs/adr も検査する。
エラーが1件以上あれば終了コード1を返す。標準ライブラリのみ使用。
"""

import argparse
import re
import sys
from pathlib import Path

REQUIRED_H2 = [
    "方針",
    "既存コードの調査",
    "変更内容",
    "データ",
    "移行・リリース",
    "受け入れ条件との対応",
    "テスト方針",
    "技術判断",
    "リスク",
]
STATUSES = ["drafting", "clarifying", "approved"]
SLUG = r"[a-z0-9]+(?:-[a-z0-9]+)*"
REQ_ID_RE = re.compile(rf"^{SLUG}\.{SLUG}$")
REQ_AC_RE = re.compile(rf"^\s+- ({SLUG}\.{SLUG}\.ac\d+)(?:\s|$)")
COMPONENT_RE = re.compile(rf"^({SLUG}) (.+)（(新規|変更|削除)）$")
MAPPING_RE = re.compile(rf"^- ({SLUG}\.{SLUG}\.ac\d+):\s*(.+?)\s*/\s*検証:\s*(.+)$")
VERIFY_RE = re.compile(r"^(自動テスト（(単体|結合|E2E)）|手動確認)$")
D_HEAD_RE = re.compile(r"^(D-\d+) (.+)$")
D_REF_RE = re.compile(r"(?<![A-Za-z0-9])D-\d+(?!\d)")
MARK_RE = re.compile(r"\[要確認: (D-\d+)\]")
ADR_VALUE_RE = re.compile(rf"^する（adr:({SLUG})）$")
SURVEY_RE = re.compile(r"^- ([^\s:：（]+)\s*[:：]")
BASIS_RE = re.compile(r"（根拠:\s*([^）]+)）\s*$")
AC_ID_RE = re.compile(rf"^{SLUG}\.{SLUG}\.ac\d+$")
D_ID_RE = re.compile(r"^D-\d+$")
PREFIXED_RE = re.compile(rf"^(decision|adr):({SLUG})$")
OTHER_DESIGN_RE = re.compile(r"^docs/specs/[^/]+/design\.md")
PROD_NOTE_RE = re.compile(r"本番[^。]{0,30}?(呼ばない|使わない|使用しない|export しない)")
CONSISTENT_RE = re.compile(r"整合")
FORMULA_RE = re.compile(r"[×=＝]")
FOUNDATION = "なし（基盤）"
VAGUE_RE = re.compile(r"(等|など)(?=[。、）)\s]|$)|を表す応答|適切[なに]")
DATA_VAGUE_RE = re.compile(r"または")

COMPONENT_FIELDS = ["場所", "役割", "入出力", "対応する要件"]
DECISION_STATES = {
    "open": ["選択肢"],
    "decided": ["選択肢", "決定", "理由", "決定者", "ADR"],
}
DECIDERS = ["ユーザー", "既存の慣習"]
INTERPRETATION = "要件の解釈"
ADR_STATUSES = ["proposed", "accepted", "superseded"]
ADR_FIELDS = ["背景", "決定", "理由", "検討した選択肢", "影響", "決定日"]


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
                value = value.strip()
                if value.startswith("[") and value.endswith("]"):
                    value = [v.strip() for v in value[1:-1].split(",") if v.strip()]
                fm[key.strip()] = value
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


def get_field(body, name):
    values = get_fields(body, name)
    return values[0] if values else None


def get_fields(body, name):
    pattern = re.compile(rf"^- {re.escape(name)}:\s*(.*)$")
    return [m.group(1).strip() for m in (pattern.match(l) for l in body) if m]


def items(body):
    return [l for l in body if l.startswith("- ")]


def is_none_list(body):
    return [l.strip() for l in items(body)] == ["- なし"]


def is_unproven_consistency(line):
    """数値を挙げて「整合」と書いているのに、換算の式がない行か。"""
    return bool(CONSISTENT_RE.search(line) and re.search(r"\d", line) and not FORMULA_RE.search(line))


def find_root(path):
    p = Path(path).resolve()
    if len(p.parents) < 4:
        return None
    if p.parents[1].name == "specs" and p.parents[2].name == "docs":
        return p.parents[3]
    return None


def parse_requirements(path):
    lines = path.read_text(encoding="utf-8").splitlines()
    fm, start = parse_front_matter(lines)
    sections = dict(split_sections(lines[start:], "## "))
    requirements = {}
    for heading, body in split_sections(sections.get("要件", []), "### "):
        req_id = heading.split(maxsplit=1)[0] if heading else ""
        if REQ_ID_RE.match(req_id):
            requirements[req_id] = [m.group(1) for m in (REQ_AC_RE.match(l) for l in body) if m]
    return fm or {}, requirements


def check_requirements_file(path, fm, root, report):
    req_path = path.parent / "requirements.md"
    if not req_path.is_file():
        report.error("同じディレクトリに requirements.md がありません。")
        return {}, []
    req_fm, requirements = parse_requirements(req_path)
    if req_fm.get("status") != "approved":
        report.error(f"requirements.md が approved ではありません（status: {req_fm.get('status', '')}）。sdd-req で承認を済ませてください。")
    if req_fm.get("feature") and fm.get("feature") and req_fm.get("feature") != fm.get("feature"):
        report.error(f"feature が requirements.md（{req_fm.get('feature')}）と一致しません。")
    if not requirements:
        report.error("requirements.md から要件を読み取れませんでした。")
    depends_on = req_fm.get("depends_on") if isinstance(req_fm.get("depends_on"), list) else []
    if root is not None:
        for number in depends_on:
            found = sorted((root / "docs" / "specs").glob(f"{number}-*/requirements.md"))
            if not found:
                report.warn(f"依存先 #{number} の requirements.md が見つかりません。実装済みで削除されたかを確認してください。")
                continue
            dep_fm, _ = parse_requirements(found[0])
            if dep_fm.get("status") != "approved":
                report.error(f"依存先 #{number} の requirements.md が approved ではありません（status: {dep_fm.get('status', '')}）。依存先の承認を待ってください。")
    return requirements, depends_on


def dependency_locations(root, depends_on):
    """実装前の依存先の design.md（approved）にある、コンポーネントの場所を返す。"""
    locations = set()
    if root is None:
        return locations
    for number in depends_on:
        for design in sorted((root / "docs" / "specs").glob(f"{number}-*/design.md")):
            lines = design.read_text(encoding="utf-8").splitlines()
            fm, start = parse_front_matter(lines)
            if not fm or fm.get("status") != "approved":
                continue
            changes = dict(split_sections(lines[start:], "## ")).get("変更内容", [])
            for _, c_body in split_sections(changes, "### "):
                for loc in (get_field(c_body, "場所") or "").split(","):
                    if loc.strip():
                        locations.add(loc.strip())
    return locations


def check(path, target):
    report = Report()
    text = path.read_text(encoding="utf-8")
    lines = text.splitlines()
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
    level = STATUSES.index(effective)

    requirements, depends_on = check_requirements_file(path, fm, root, report)
    dep_locations = dependency_locations(root, depends_on)
    all_acs = [ac for acs in requirements.values() for ac in acs]

    body = lines[start:]
    sections = split_sections(body, "## ")
    headings = [h for h, _ in sections]
    if headings != REQUIRED_H2:
        missing = [h for h in REQUIRED_H2 if h not in headings]
        extra = [h for h in headings if h not in REQUIRED_H2]
        if missing:
            report.error(f"見出しがありません: {', '.join(missing)}")
        if extra:
            report.error(f"決められていない見出しがあります: {', '.join(extra)}")
        if not missing and not extra:
            report.error(f"見出しの順番が違います。正しい順番: {', '.join(REQUIRED_H2)}")
    sec = dict(sections)

    for name in ["方針", "既存コードの調査", "データ", "移行・リリース", "テスト方針", "リスク"]:
        if name in sec and not items(sec[name]):
            report.error(f"「{name}」が空です。中身がない場合は「- なし」と書いてください。")

    # 既存コードの調査
    if root is not None:
        for line in items(sec.get("既存コードの調査", [])):
            m = SURVEY_RE.match(line)
            if m and ("/" in m.group(1) or "." in m.group(1)) and not (root / m.group(1)).exists():
                report.warn(f"既存コードの調査のパス「{m.group(1)}」が見つかりません。実際に読んだファイルだけを書いてください。")

    # 変更内容
    components = {}
    new_locations = set()
    covered_reqs = set()
    basis_refs = []
    comp_sections = split_sections(sec.get("変更内容", []), "### ")
    if "変更内容" in sec and not comp_sections:
        report.error("「変更内容」にコンポーネントがありません。")
    for heading, c_body in comp_sections:
        m = COMPONENT_RE.match(heading)
        if not m:
            report.error(f"コンポーネントの見出し「{heading}」の形式が違います。「<コンポーネントID> <名前>（新規|変更|削除）」で書いてください。")
            continue
        comp_id, kind = m.group(1), m.group(3)
        if comp_id in components:
            report.error(f"コンポーネントID {comp_id} が重複しています。")
        components[comp_id] = kind
        for key in COMPONENT_FIELDS:
            if not get_field(c_body, key):
                report.error(f"コンポーネント {comp_id} に「{key}」がありません。")
        location = get_field(c_body, "場所")
        if kind == "新規" and location:
            new_locations.update(loc.strip() for loc in location.split(",") if loc.strip())
        if root is not None and location:
            exists = (root / location).exists()
            planned = location in dep_locations
            if kind in ("変更", "削除") and not exists and not planned:
                report.error(f"コンポーネント {comp_id} は（{kind}）ですが、場所「{location}」が見つかりません。未実装の依存先のファイルなら、依存先の design.md（approved）の場所と同じパスにしてください。")
            if kind == "新規" and exists:
                report.warn(f"コンポーネント {comp_id} は（新規）ですが、場所「{location}」はすでにあります。（変更）ではないか確認してください。")
            elif kind == "新規" and planned:
                report.error(f"コンポーネント {comp_id} は（新規）ですが、場所「{location}」は依存先の設計にあるファイルです。（変更）にしてください。")
        req_field = get_field(c_body, "対応する要件") or ""
        if req_field != FOUNDATION:
            for req_id in [r.strip() for r in req_field.split(",") if r.strip()]:
                if req_id not in requirements:
                    report.error(f"コンポーネント {comp_id} の対応する要件 {req_id} が requirements.md にありません。要件を直接実現しない基盤なら「{FOUNDATION}」と書いてください。")
                covered_reqs.add(req_id)
        for behavior in get_fields(c_body, "決めておく振る舞い"):
            bm = BASIS_RE.search(behavior)
            if not bm:
                report.error(f"コンポーネント {comp_id} の決めておく振る舞い「{behavior[:40]}」に（根拠: ...）がありません。要件IDか D-xx などを行末に書いてください。")
                continue
            for token in [t.strip() for t in bm.group(1).split(",") if t.strip()]:
                basis_refs.append((comp_id, token))
        for line in get_fields(c_body, "入出力") + get_fields(c_body, "決めておく振る舞い"):
            vm = VAGUE_RE.search(line)
            if vm:
                report.warn(f"コンポーネント {comp_id} に「{vm.group(0)}」があります。実装する側に選択を残さない書き方にしてください。")
    for req_id in requirements:
        if req_id not in covered_reqs:
            report.error(f"要件 {req_id} が、どのコンポーネントの「対応する要件」にも載っていません。")
    for line in items(sec.get("データ", [])) + [l for l in sec.get("データ", []) if l.startswith("  - ")]:
        vm = VAGUE_RE.search(line) or DATA_VAGUE_RE.search(line)
        if vm:
            report.warn(f"「データ」に「{vm.group(0)}」があります（{line.strip()[:40]}）。1つに決めて書いてください。")

    for name in ["変更内容", "テスト方針", "リスク"]:
        for line in sec.get(name, []):
            pm = PROD_NOTE_RE.search(line)
            if pm:
                report.warn(f"「{name}」に「{pm.group(0)}」があります（{line.strip()[:40]}）。注意書きではなく、本番で使えなくする仕組みを書いてください。")
    for line in items(sec.get("リスク", [])):
        if is_unproven_consistency(line):
            report.warn(f"「リスク」に「整合」があります（{line.strip()[:40]}）。要件の数値を制約の単位に換算した式（例: 72文字 × 3バイト = 216バイト）を書いて確かめてください。")

    # 受け入れ条件との対応
    mapped = {}
    for line in items(sec.get("受け入れ条件との対応", [])):
        m = MAPPING_RE.match(line)
        if not m:
            report.error(f"受け入れ条件との対応「{line}」の形式が違います。「- <受け入れ条件ID>: <コンポーネントID>, ... / 検証: <検証方法>」で書いてください。")
            continue
        ac_id, comps, verify = m.group(1), m.group(2), m.group(3).strip()
        if ac_id in mapped:
            report.error(f"受け入れ条件 {ac_id} が2回以上載っています。")
        mapped[ac_id] = verify
        if requirements and ac_id not in all_acs:
            report.error(f"受け入れ条件 {ac_id} が requirements.md にありません。")
        for comp in [c.strip() for c in comps.split(",") if c.strip()]:
            if comp not in components:
                report.error(f"受け入れ条件 {ac_id} のコンポーネント {comp} が「変更内容」にありません。")
        if not VERIFY_RE.match(verify):
            report.error(f"受け入れ条件 {ac_id} の検証方法「{verify}」は無効です。使える値: 自動テスト（単体）, 自動テスト（結合）, 自動テスト（E2E）, 手動確認")
    for ac_id in all_acs:
        if ac_id not in mapped:
            report.error(f"受け入れ条件 {ac_id} が「受け入れ条件との対応」に載っていません。")
    if any(v == "手動確認" for v in mapped.values()) and "手動" not in "\n".join(sec.get("テスト方針", [])):
        report.warn("手動確認の受け入れ条件があります。「テスト方針」にその理由を書いてください。")

    # 技術判断
    decisions = {}
    adr_ids = []
    d_sections = split_sections(sec.get("技術判断", []), "### ")
    if "技術判断" in sec and not d_sections and not is_none_list(sec["技術判断"]):
        report.error("「技術判断」に D-xx の見出しがありません。ない場合は「- なし」と書いてください。")
    for heading, d_body in d_sections:
        m = D_HEAD_RE.match(heading)
        if not m:
            report.error(f"技術判断の見出し「{heading}」の形式が違います。「D-xx <論点>」で書いてください。")
            continue
        d_id = m.group(1)
        if d_id in decisions:
            report.error(f"技術判断 {d_id} が重複しています。")
        state = get_field(d_body, "状態") or ""
        decisions[d_id] = state
        if state not in DECISION_STATES:
            report.error(f"技術判断 {d_id} の状態「{state}」は無効です。使える値: {', '.join(DECISION_STATES)}")
            continue
        for key in DECISION_STATES[state]:
            if not get_field(d_body, key):
                report.error(f"技術判断 {d_id}（{state}）に「{key}」がありません。")
        kind = get_field(d_body, "種類")
        if kind is not None and kind != INTERPRETATION:
            report.error(f"技術判断 {d_id} の種類「{kind}」は無効です。使える値: {INTERPRETATION}")
        if state != "decided":
            continue
        options = [o.strip() for o in (get_field(d_body, "選択肢") or "").split(" / ") if o.strip()]
        chosen = get_field(d_body, "決定")
        if chosen and options and chosen not in options:
            report.error(f"技術判断 {d_id} の決定「{chosen[:40]}」が選択肢にありません。選択肢のどれかをそのまま書くか、選択肢に書き足してください。")
        decider = get_field(d_body, "決定者")
        if decider and decider not in DECIDERS:
            report.error(f"技術判断 {d_id} の決定者「{decider}」は無効です。使える値: {', '.join(DECIDERS)}")
        if decider == "既存の慣習":
            basis = get_field(d_body, "根拠")
            if not basis:
                report.error(f"技術判断 {d_id} は既存の慣習に従っているので、「根拠」にファイルのパスか adr:<id> を書いてください。")
            elif basis in new_locations:
                report.error(f"技術判断 {d_id} の根拠「{basis}」は、この設計で新しく作るファイルです。既存の慣習の根拠には、すでにあるファイル、依存先の場所、adr:<id> を書いてください。慣習がなければユーザーに質問してください。")
            elif OTHER_DESIGN_RE.match(basis):
                report.error(f"技術判断 {d_id} の根拠「{basis}」は、実装後に削除される design.md です。依存先の場所のパスか adr:<id> を書いてください。")
            elif root is not None and not basis.startswith("adr:") and not (root / basis).exists() and basis not in dep_locations:
                report.warn(f"技術判断 {d_id} の根拠「{basis}」が見つかりません。")
            elif root is not None and basis.startswith("adr:"):
                adr_file = root / "docs" / "adr" / f"{basis[4:]}.md"
                if not adr_file.is_file():
                    report.error(f"技術判断 {d_id} の根拠 {basis} が docs/adr にありません。")
        reason = get_field(d_body, "理由") or ""
        if is_unproven_consistency(reason):
            report.warn(f"技術判断 {d_id} の理由に「整合」があります。要件の数値を制約の単位に換算した式（例: 72文字 × 3バイト = 216バイト）を書いて確かめてください。")
        adr = get_field(d_body, "ADR") or ""
        if adr and adr != "しない":
            am = ADR_VALUE_RE.match(adr)
            if not am:
                report.error(f"技術判断 {d_id} の ADR「{adr}」の形式が違います。「しない」か「する（adr:<ID>）」で書いてください。")
            else:
                adr_ids.append((d_id, am.group(1)))

    # 決めておく振る舞いの根拠
    for comp_id, token in basis_refs:
        pm = PREFIXED_RE.match(token)
        if REQ_ID_RE.match(token):
            if requirements and token not in requirements:
                report.error(f"コンポーネント {comp_id} の根拠 {token} が requirements.md にありません。")
        elif AC_ID_RE.match(token):
            if requirements and token not in all_acs:
                report.error(f"コンポーネント {comp_id} の根拠 {token} が requirements.md にありません。")
        elif D_ID_RE.match(token):
            pass
        elif pm:
            kind, ref_id = pm.group(1), pm.group(2)
            folder = "decisions" if kind == "decision" else "adr"
            if root is not None and not (root / "docs" / folder / f"{ref_id}.md").is_file():
                report.error(f"コンポーネント {comp_id} の根拠 {token} が docs/{folder} にありません。")
        else:
            report.error(f"コンポーネント {comp_id} の根拠「{token}」は使えません。要件ID、受け入れ条件ID、D-xx、decision:<id>、adr:<id> のいずれかを書いてください。")

    # 本文からの D-xx 参照とマーカー
    other_text = "\n".join(l for h, b in sections if h != "技術判断" for l in b)
    for ref in sorted(set(D_REF_RE.findall(other_text))):
        if ref not in decisions:
            report.error(f"本文の {ref} が「技術判断」にありません。")
    for ref in sorted(set(MARK_RE.findall(other_text))):
        if decisions.get(ref) == "decided":
            report.error(f"{ref} は決定済みですが、本文に [要確認: {ref}] が残っています。決定内容を本文に反映してください。")

    # ADR
    if root is not None:
        adr_dir = root / "docs" / "adr"
        for d_id, adr_id in adr_ids:
            adr_file = adr_dir / f"{adr_id}.md"
            if not adr_file.is_file():
                msg = f"技術判断 {d_id} の ADR docs/adr/{adr_id}.md がありません。テンプレートから作成してください。"
                report.error(msg) if level >= STATUSES.index("approved") else report.warn(msg)
                continue
            check_adr(adr_file, fm.get("feature", ""), level, report)

    # status の関門
    open_ds = [d for d, s in decisions.items() if s == "open"]
    markers = sorted(set(MARK_RE.findall(other_text)))
    if level >= STATUSES.index("approved"):
        if open_ds:
            report.error(f"approved にするには、すべての技術判断を decided にしてください（未決定: {', '.join(open_ds)}）。")
        if markers:
            report.error(f"approved にするには、本文の [要確認] をなくしてください（残り: {', '.join(markers)}）。")
    elif level == STATUSES.index("clarifying") and not open_ds and not markers:
        report.warn("未決定の技術判断がありません。セルフレビューを行い、ユーザーの確認を取ってください。")

    return report, effective


def check_adr(adr_file, feature, level, report):
    rel = f"docs/adr/{adr_file.name}"
    lines = adr_file.read_text(encoding="utf-8").splitlines()
    fm, start = parse_front_matter(lines)
    if fm is None:
        report.error(f"{rel} に front matter がありません。")
        return
    if fm.get("id") != adr_file.stem:
        report.error(f"{rel} のファイル名と id「{fm.get('id', '')}」が一致しません。")
    status = fm.get("status", "")
    if status not in ADR_STATUSES:
        report.error(f"{rel} の status「{status}」は無効です。使える値: {', '.join(ADR_STATUSES)}")
    if status == "superseded":
        report.error(f"{rel} は置き換え済み（superseded）です。置き換え先のADRを参照してください。")
    if fm.get("feature") != feature:
        return
    body = lines[start:]
    for key in ADR_FIELDS:
        if not get_field(body, key):
            report.error(f"{rel} に「{key}」がありません。")
    if level >= STATUSES.index("approved") and status == "proposed":
        report.error(f"approved にするには、{rel} を accepted にしてください。")


def main():
    parser = argparse.ArgumentParser(description="design.md を検証する")
    parser.add_argument("path", type=Path)
    parser.add_argument("--target", choices=STATUSES, help="この status に進める状態かを検査する")
    args = parser.parse_args()

    if not args.path.is_file():
        print(f"ファイルが見つかりません: {args.path}", file=sys.stderr)
        return 2

    report, effective = check(args.path, args.target)
    for msg in report.errors:
        print(f"ERROR: {msg}")
    for msg in report.warnings:
        print(f"WARN: {msg}")
    print(f"結果（検査基準: {effective}）: エラー {len(report.errors)} 件 / 警告 {len(report.warnings)} 件")
    return 1 if report.errors else 0


if __name__ == "__main__":
    sys.exit(main())
