#!/usr/bin/env python3
"""sdd-req の requirements.md の形式と、各 status に進むための条件を検査する。

使い方:
    python3 validate_requirements.py <requirements.md> [--target in_review|approved] [--no-branches]

--target を省略した場合は front matter の status を基準に検査する。
docs/specs/<feature>/requirements.md にあるファイルは、docs/capabilities、docs/decisions、
docs/glossary.md、他の要件定義（作業ツリーとリモートブランチ）との衝突も検査する。
リモートブランチを最新にするには、事前に git fetch を実行する。--no-branches で省略できる。
エラーが1件以上あれば終了コード1を返す。標準ライブラリのみ使用。
"""

import argparse
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from sddlib import (  # noqa: E402
    NEW_TERM_MARK,
    TREE,
    collect,
    existing_requirements,
    find_root,
    get_field,
    normalize_text,
    parse_decision,
    parse_front_matter,
    parse_glossary,
    parse_registry,
    parse_spec,
    split_sections,
)

REQUIRED_H2 = [
    "顧客への確認事項",
    "ユーザーストーリー",
    "目的・成功の基準",
    "スコープ",
    "用語",
    "要件",
    "制約・前提",
    "既存仕様への影響",
    "質問ログ",
]
STATUSES = ["drafting", "clarifying", "in_review", "approved"]
Q_STATES = {
    "open": [],
    "answered_by_user": ["回答", "回答者", "回答日", "反映先"],
    "needs_customer": ["暫定の扱い", "反映先"],
    "answered_by_customer": ["回答", "回答者", "回答日", "顧客確認日", "反映先"],
    "withdrawn": ["理由"],
}
ANSWERERS = ["ユーザー", "顧客"]
KINDS = ["機能", "非機能"]
AC_KEYS = ["前提", "操作", "結果"]
SPLIT_MAX_REQS = 5
SPLIT_MAX_CAPS = 2

SLUG = r"[a-z0-9]+(?:-[a-z0-9]+)*"
SLUG_RE = re.compile(rf"^{SLUG}$")
REQ_ID_RE = re.compile(rf"^({SLUG})\.({SLUG})$")
REQ_ID_IN_TEXT_RE = re.compile(rf"(?<![a-z0-9.-])({SLUG}\.{SLUG})(?![a-z0-9-])")
FEATURE_RE = re.compile(rf"^(\d+)-{SLUG}$")
AC_LINE_RE = re.compile(rf"^(\s+)- ({SLUG}\.{SLUG}\.ac\d+)(?:\s|$)")
Q_ID_RE = re.compile(r"(?<![A-Za-z0-9])Q-\d+(?!\d)")
Q_HEADING_RE = re.compile(r"^(Q-\d+)\s+\S")
MARKER_RE = re.compile(r"\[要確認:\s*(Q-\d+)\]")
CHECK_ITEM_RE = re.compile(r"^- \[( |x|X)\] (.+)$")


class Report:
    def __init__(self):
        self.errors = []
        self.warnings = []

    def error(self, msg):
        self.errors.append(msg)

    def warn(self, msg):
        self.warnings.append(msg)


def is_none_list(body):
    items = [l.strip() for l in body if l.strip().startswith("- ")]
    return items == ["- なし"]


def list_items(body):
    return [l.strip()[2:].strip() for l in body if l.startswith("- ")]


def parse_acs(req_id, body, report):
    ac_ids = []
    i = 0
    while i < len(body):
        m = AC_LINE_RE.match(body[i])
        if not m:
            i += 1
            continue
        indent, ac_id = len(m.group(1)), m.group(2)
        children = []
        j = i + 1
        while j < len(body):
            line = body[j]
            if line.strip() and len(line) - len(line.lstrip()) <= indent:
                break
            children.append(line)
            j += 1
        if not ac_id.startswith(req_id + ".ac"):
            report.error(f"受け入れ条件 {ac_id} のIDが要件ID {req_id} で始まっていません。")
        for key in AC_KEYS:
            values = [
                c.strip()[len(f"- {key}:"):].strip()
                for c in children
                if c.strip().startswith(f"- {key}:")
            ]
            if not values or not values[0]:
                report.error(f"受け入れ条件 {ac_id} に「{key}」がありません。")
        ac_ids.append(ac_id)
        i = j
    return ac_ids


def pending_requirements(entries, depends_on):
    """depends_on の依存先のうち、承認済みでまだ docs/capabilities に取り込まれていない要件を返す。"""
    numbers = {str(n) for n in depends_on} if isinstance(depends_on, list) else set()
    pending = {}
    for source, rel, other_text in entries:
        if source != TREE or not rel.startswith("docs/specs/"):
            continue
        spec = parse_spec(other_text)
        if str(spec["fm"].get("issue", "")) in numbers and spec["fm"].get("status") == "approved":
            pending.update(spec["requirements"])
    return pending


def cross_check(path, text, fm, level, scan_branches, report):
    """docs/ 配下の共有情報と、他の要件定義（作業ツリーとリモートブランチ）との衝突を検査する。"""
    root = find_root(path)
    if root is None:
        return
    own = parse_spec(text)
    feature = str(fm.get("feature", ""))
    capabilities = fm.get("capabilities") if isinstance(fm.get("capabilities"), list) else []
    entries, notes = collect(root, scan_branches)
    for note in notes:
        report.warn(note)

    # 業務領域の一覧
    readme = root / "docs" / "capabilities" / "README.md"
    if not readme.is_file():
        report.error("docs/capabilities/README.md がありません。スキルのテンプレートから作成してください。")
    else:
        registry = parse_registry(readme.read_text(encoding="utf-8"))
        for cap in capabilities:
            if cap not in registry:
                report.error(f"業務領域「{cap}」が docs/capabilities/README.md にありません。既存の業務領域を使うか、ユーザーに確認して一覧に追加してください。")

    # 既存の要件との関係
    existing = existing_requirements(root)
    pending = pending_requirements(entries, fm.get("depends_on"))
    for req_id in own["added"]:
        if req_id in existing:
            report.error(f"追加する {req_id} は docs/capabilities にすでにあります。既存の要件を変えるなら「変更」に載せてください。")
    for req_id in own["changed"] + own["removed"]:
        if req_id not in existing and req_id not in pending:
            report.error(f"{req_id} は docs/capabilities にも、depends_on の依存先（approved）の要件にもありません。新しい要件なら「追加」に載せてください。")
    for req_id, current in own["currents"].items():
        base = existing[req_id] if req_id in existing else pending.get(req_id)
        if base is not None and normalize_text(current) != normalize_text(base):
            report.error(f"{req_id} の「現行」が docs/capabilities（未実装の依存先なら、その requirements.md）の要件文と一致しません。他の変更が先に取り込まれた可能性があります。最新の要件文を確認し、変更内容を見直してください。")

    # 他の要件定義との重なり
    others = []
    for source, rel, other_text in entries:
        if rel.startswith("docs/specs/") and rel.split("/")[2] != feature:
            others.append((source, rel.split("/")[2], parse_spec(other_text)))
    own_touched = set(own["changed"]) | set(own["removed"])
    for source, other_feature, other in others:
        label = f"{other_feature}（{'main' if source == TREE else '作業中: ' + source}）"
        other_status = other["fm"].get("status", "")
        for req_id in set(own["added"]) & set(other["added"]):
            msg = f"追加する {req_id} は {label} でも追加されています。IDを変えるか、担当者と調整してください。"
            report.error(msg) if source == TREE else report.warn(msg)
        for req_id in own_touched & (set(other["changed"]) | set(other["removed"])):
            report.warn(f"{req_id} は {label}（{other_status}）でも変更・削除されています。取り込み順と内容を担当者と調整してください。")
        for term, definition in own["terms"].items():
            other_def = other["terms"].get(term)
            if (
                definition.endswith(NEW_TERM_MARK)
                and other_def
                and normalize_text(other_def.removesuffix(NEW_TERM_MARK)) != normalize_text(definition.removesuffix(NEW_TERM_MARK))
            ):
                report.warn(f"用語「{term}」は {label} で別の定義になっています。定義をそろえてください。")

    # 用語集
    glossary_file = root / "docs" / "glossary.md"
    glossary = parse_glossary(glossary_file.read_text(encoding="utf-8")) if glossary_file.is_file() else {}
    for term, definition in own["terms"].items():
        if definition.endswith(NEW_TERM_MARK) and term in glossary:
            report.error(f"用語「{term}」は docs/glossary.md にすでにあります。「（新規）」を外し、定義を glossary に合わせてください。")
        elif not definition.endswith(NEW_TERM_MARK) and glossary_file.is_file() and term not in glossary:
            report.warn(f"用語「{term}」は docs/glossary.md にありません。新しい用語なら「（新規）」を付けてください。")

    # 全体方針
    tree_decisions = {}
    branch_decisions = {}
    for source, rel, other_text in entries:
        if rel.startswith("docs/decisions/"):
            decision = parse_decision(other_text, rel)
            target_map = tree_decisions if source == TREE else branch_decisions
            target_map.setdefault(decision["id"], []).append((source, rel, decision))
    for decision_id in sorted(own["decisions"]):
        if decision_id not in tree_decisions:
            report.error(f"根拠の decision:{decision_id} が docs/decisions にありません（作業中ブランチにしかない全体方針は根拠にできません）。")
            continue
        status = tree_decisions[decision_id][0][2]["status"]
        if status == "superseded":
            report.error(f"根拠の decision:{decision_id} は置き換え済み（superseded）です。置き換え先の全体方針を参照してください。")
    for decision_id, items in tree_decisions.items():
        _, rel, decision = items[0]
        if Path(rel).stem != decision_id:
            report.error(f"{rel} のファイル名と id「{decision_id}」が一致しません。")
        if decision["status"] not in ("proposed", "accepted", "superseded"):
            report.error(f"{rel} の status「{decision['status']}」は無効です。使える値: proposed, accepted, superseded")
        if decision["status"] == "superseded" and not decision["superseded_by"]:
            report.error(f"{rel} は superseded なので superseded_by を書いてください。")
        if decision["feature"] != feature:
            continue
        for key in ["決定", "理由", "適用範囲", "決定日"]:
            if not get_field(decision["body"], key):
                report.error(f"{rel} に「{key}」がありません。")
        if decision_id in branch_decisions:
            sources = ", ".join(s for s, _, _ in branch_decisions[decision_id])
            report.warn(f"全体方針 {decision_id} と同じIDが作業中ブランチ（{sources}）にもあります。IDを変えるか、担当者と調整してください。")
        if decision_id not in own["decisions"] and decision["status"] != "superseded":
            report.warn(f"このissueで作った全体方針 {decision_id} が、どの要件の根拠からも参照されていません。")
        if level >= STATUSES.index("approved") and decision["status"] == "proposed":
            report.error(f"approved にするには、このissueで作った全体方針 {decision_id} を accepted にし、顧客確認日を書いてください。")
        if decision["status"] == "accepted" and not get_field(decision["body"], "顧客確認日"):
            report.error(f"{rel} は accepted なので「顧客確認日」を書いてください。")

    # 依存先
    for number in fm.get("depends_on") or []:
        matches = [(s, f, o) for s, f, o in others if str(o["fm"].get("issue", "")) == str(number)]
        if not matches:
            report.warn(f"依存先 #{number} の要件定義が見つかりません（まだ作られていない可能性があります）。")
            continue
        if not any(o["fm"].get("status") == "approved" for _, _, o in matches):
            states = ", ".join(f"{f}: {o['fm'].get('status', '')}" for _, f, o in matches)
            report.warn(f"依存先 #{number} はまだ approved ではありません（{states}）。design に進む前に approved になっている必要があります。")


def check(path, target, scan_branches=True):
    report = Report()
    text = path.read_text(encoding="utf-8")
    lines = text.splitlines()

    fm, body_start = parse_front_matter(lines)
    if fm is None:
        report.error("YAML front matter（先頭の --- で囲まれた部分）がありません。")
        return report, None
    body = lines[body_start:]

    for key in ["issue", "feature", "status", "capabilities"]:
        if key not in fm or fm[key] in ("", []):
            report.error(f"front matter に {key} がありません。")
    depends_on = fm.get("depends_on")
    if depends_on is None:
        report.error("front matter に depends_on がありません。依存先がなければ depends_on: [] と書いてください。")
        depends_on = []
    elif not isinstance(depends_on, list) or not all(str(n).isdigit() for n in depends_on):
        report.error("depends_on は [12, 15] のように issue 番号のリストで書いてください。")
        depends_on = []

    status = fm.get("status", "")
    if status and status not in STATUSES:
        report.error(f"status「{status}」は無効です。使える値: {', '.join(STATUSES)}")
    effective = target or status
    level = STATUSES.index(effective) if effective in STATUSES else 0

    issue = str(fm.get("issue", ""))
    if issue and not issue.isdigit():
        report.error(f"issue「{issue}」は数字である必要があります。")

    feature = str(fm.get("feature", ""))
    if feature:
        m = FEATURE_RE.match(feature)
        if not m:
            report.error(f"feature「{feature}」は {{issue番号}}-{{英語の短い名前}}（小文字・ハイフン区切り）である必要があります。")
        elif issue and m.group(1) != issue:
            report.error(f"feature「{feature}」の先頭が issue 番号 {issue} と一致しません。")
        if path.name == "requirements.md" and path.resolve().parent.name != feature:
            report.error(f"ディレクトリ名「{path.resolve().parent.name}」が feature「{feature}」と一致しません。")

    capabilities = fm.get("capabilities", [])
    if not isinstance(capabilities, list):
        report.error("capabilities は [a, b] の形式で書いてください。")
        capabilities = []
    for cap in capabilities:
        if not SLUG_RE.match(cap):
            report.error(f"業務領域「{cap}」は小文字の英数字とハイフンで書いてください。")

    if not any(l.startswith("# ") for l in body):
        report.error("H1 見出し（# タイトル）がありません。")

    h2 = split_sections(body, "## ")
    h2_names = [name for name, _ in h2]
    sections = {name: content for name, content in h2}
    for name in REQUIRED_H2:
        if name not in sections:
            report.error(f"見出し「## {name}」がありません。")
    for name in h2_names:
        if name not in REQUIRED_H2:
            report.error(f"見出し「## {name}」はテンプレートにありません。")
    present = [n for n in h2_names if n in REQUIRED_H2]
    if present != [n for n in REQUIRED_H2 if n in present]:
        report.error("H2 見出しの順番がテンプレートと異なります。")

    scope = {n for n, _ in split_sections(sections.get("スコープ", []), "### ")}
    for name in ["対象", "対象外"]:
        if "スコープ" in sections and name not in scope:
            report.error(f"スコープに「### {name}」がありません。")

    # 質問ログ
    questions = {}
    q_section = sections.get("質問ログ", [])
    for heading, q_body in split_sections(q_section, "### "):
        m = Q_HEADING_RE.match(heading)
        if not m:
            report.error(f"質問の見出し「{heading}」は「Q-01 質問文」の形式にしてください。")
            continue
        qid = m.group(1)
        if qid in questions:
            report.error(f"質問 {qid} が重複しています。")
        state = get_field(q_body, "状態")
        if state not in Q_STATES:
            report.error(f"{qid} の状態「{state}」は無効です。使える値: {', '.join(Q_STATES)}")
            continue
        for key in Q_STATES[state]:
            if not get_field(q_body, key):
                report.error(f"{qid}（{state}）に「{key}」がありません。")
        answerer = get_field(q_body, "回答者")
        if answerer and answerer not in ANSWERERS:
            report.error(f"{qid} の回答者「{answerer}」は無効です。使える値: {', '.join(ANSWERERS)}")
        if state == "answered_by_user" and answerer == "顧客":
            report.error(f"{qid} は回答者が顧客なので、状態を answered_by_customer にしてください。")
        if state == "answered_by_user" and get_field(q_body, "顧客確認日"):
            report.error(f"{qid} は顧客確認日があるので、状態を answered_by_customer にしてください。")
        questions[qid] = {
            "state": state,
            "targets": get_field(q_body, "反映先") or "",
            "answer": get_field(q_body, "回答") or "",
        }
    if not questions and q_section and not is_none_list(q_section):
        report.error("質問ログに質問がありません。質問がない場合は「- なし」と書いてください。")

    # 要件
    requirements = {}
    for heading, r_body in split_sections(sections.get("要件", []), "### "):
        parts = heading.split(maxsplit=1)
        req_id = parts[0]
        if not REQ_ID_RE.match(req_id):
            report.error(f"要件ID「{req_id}」は <業務領域>.<英語の短い名前> の形式にしてください。")
            continue
        if len(parts) < 2:
            report.error(f"要件 {req_id} に見出しのタイトルがありません。")
        cap = REQ_ID_RE.match(req_id).group(1)
        if cap not in capabilities:
            report.error(f"要件 {req_id} の業務領域「{cap}」が front matter の capabilities にありません。")
        if req_id in requirements:
            report.error(f"要件ID {req_id} が重複しています。")
        kind = get_field(r_body, "種別")
        if kind not in KINDS:
            report.error(f"要件 {req_id} の種別「{kind}」は無効です。使える値: {', '.join(KINDS)}")
        if not get_field(r_body, "要件"):
            report.error(f"要件 {req_id} に「要件」がありません。")
        basis = get_field(r_body, "根拠")
        if not basis:
            report.error(f"要件 {req_id} に「根拠」がありません。")
            basis = ""
        if basis:
            for qid in Q_ID_RE.findall(basis):
                if qid not in questions:
                    report.error(f"要件 {req_id} の根拠 {qid} が質問ログにありません。")
                elif questions[qid]["state"] == "withdrawn":
                    report.error(f"要件 {req_id} の根拠 {qid} は取り下げ済み（withdrawn）です。根拠から外してください。")
        ac_ids = parse_acs(req_id, r_body, report)
        if kind == "機能" and not ac_ids:
            report.error(f"要件 {req_id}（機能）に受け入れ条件がありません。")
        if kind == "非機能" and not ac_ids:
            report.warn(f"要件 {req_id}（非機能）に受け入れ条件がありません。測定できるなら追加してください。")
        requirements[req_id] = set(ac_ids)
    if not requirements:
        report.error("要件が1件もありません。")
    all_acs = [ac for acs in requirements.values() for ac in acs]
    for ac in {a for a in all_acs if all_acs.count(a) > 1}:
        report.error(f"受け入れ条件ID {ac} が重複しています。")

    # 同じ論点の質問（回答が同じで反映先が重なる）
    def normalize(text):
        return re.sub(r"[\s、。，．,.（）()「」]", "", text)

    def target_set(text):
        return {t.strip() for t in re.split(r"[,、]", text) if t.strip()}

    active = [
        (qid, q) for qid, q in questions.items() if q["state"] != "withdrawn" and q["answer"]
    ]
    def similar(a, b):
        a, b = normalize(a), normalize(b)
        short, long_ = sorted([a, b], key=len)
        return a == b or (len(short) >= 6 and short in long_)

    for i, (qid_a, qa) in enumerate(active):
        for qid_b, qb in active[i + 1:]:
            if similar(qa["answer"], qb["answer"]) and target_set(qa["targets"]) & target_set(qb["targets"]):
                report.warn(
                    f"{qid_a} と {qid_b} は回答がほぼ同じで反映先が重なっています。同じ論点なら1つにまとめ、もう一方を withdrawn にしてください。"
                )

    # 質問の反映先
    for qid, q in questions.items():
        if q["state"] == "withdrawn":
            continue
        for ref in REQ_ID_IN_TEXT_RE.findall(q["targets"]):
            if REQ_ID_RE.match(ref) and ref not in requirements:
                report.error(f"{qid} の反映先 {ref} が要件にありません。")

    # 既存仕様への影響
    impact = {n: c for n, c in split_sections(sections.get("既存仕様への影響", []), "### ")}
    impact_ids = {}
    for name in ["追加", "変更", "削除"]:
        if "既存仕様への影響" in sections and name not in impact:
            report.error(f"既存仕様への影響に「### {name}」がありません。")
            continue
        ids = []
        for item in list_items(impact.get(name, [])):
            if item == "なし":
                continue
            token = item.split(":", 1)[0].strip()
            if not REQ_ID_RE.match(token):
                report.error(f"既存仕様への影響（{name}）の「{item}」が要件IDで始まっていません。")
                continue
            if name in ("変更", "削除") and ":" not in item:
                report.error(f"既存仕様への影響（{name}）の {token} に、内容や理由を「: 」の後に書いてください。")
            ids.append(token)
        impact_ids[name] = set(ids)
    added, changed, removed = (impact_ids.get(n, set()) for n in ["追加", "変更", "削除"])
    for req_id in requirements:
        if req_id not in added | changed:
            report.error(f"要件 {req_id} が既存仕様への影響の「追加」「変更」のどちらにもありません。")
    for req_id in (added | changed) - set(requirements):
        report.error(f"既存仕様への影響の {req_id} が本文の要件にありません。")
    for req_id in added & changed:
        report.error(f"{req_id} が「追加」と「変更」の両方にあります。")
    for req_id in removed & set(requirements):
        report.error(f"削除する {req_id} が本文の要件に残っています。")
    for req_id in removed:
        cap = REQ_ID_RE.match(req_id).group(1)
        if cap not in capabilities:
            report.error(f"削除する {req_id} の業務領域「{cap}」が capabilities にありません。")
    currents = parse_spec(text)["currents"]
    for req_id in changed:
        if not currents.get(req_id):
            report.error(f"既存仕様への影響（変更）の {req_id} に、変更前の要件文を「  - 現行: 」の行で書いてください。")

    # 未確定の目印
    marker_lines = [l for name, content in h2 if name != "質問ログ" for l in content]
    markers = set(MARKER_RE.findall("\n".join(marker_lines)))
    for qid in markers:
        if qid not in questions:
            report.error(f"[要確認: {qid}] に対応する質問が質問ログにありません。")
        elif questions[qid]["state"] != "open":
            report.error(f"{qid} は回答済みなのに、本文に [要確認: {qid}] が残っています。")

    # 本文からの質問ログ参照（根拠と [要確認] の目印を除く）
    for name, content in h2:
        if name in ("顧客への確認事項", "質問ログ"):
            continue
        for line in content:
            if line.startswith("- 根拠:"):
                continue
            refs = Q_ID_RE.findall(MARKER_RE.sub("", line))
            if refs:
                report.error(f"「{name}」で {', '.join(refs)} を参照しています。本文は質問ログを参照せず、内容を直接書いてください: {line.strip()}")

    # 顧客への確認事項
    checklist = {}
    unchecked_items = []
    for line in sections.get("顧客への確認事項", []):
        m = CHECK_ITEM_RE.match(line.strip())
        if not m:
            continue
        checked = m.group(1) != " "
        if not checked:
            unchecked_items.append(m.group(2))
        for qid in Q_ID_RE.findall(m.group(2)):
            checklist[qid] = checklist.get(qid, True) and checked
    for qid, q in questions.items():
        if q["state"] in ("answered_by_user", "needs_customer") and qid not in checklist:
            msg = f"{qid}（{q['state']}）が顧客への確認事項にありません。"
            report.error(msg) if level >= STATUSES.index("in_review") else report.warn(msg)
    for qid in checklist:
        if qid not in questions:
            report.error(f"顧客への確認事項の {qid} が質問ログにありません。")
        elif questions[qid]["state"] == "withdrawn":
            report.error(f"顧客への確認事項の {qid} は取り下げ済み（withdrawn）です。確認事項から外してください。")

    # status ごとの条件
    open_qs = sorted(q for q, v in questions.items() if v["state"] == "open")
    if level >= STATUSES.index("in_review"):
        if open_qs:
            report.error(f"{effective} にするには open の質問を0件にしてください（残り: {', '.join(open_qs)}）。")
        if markers:
            report.error(f"{effective} にするには [要確認] をすべて解消してください。")
    if level >= STATUSES.index("approved"):
        waiting = sorted(
            q for q, v in questions.items() if v["state"] not in ("answered_by_customer", "withdrawn")
        )
        if waiting:
            report.error(f"approved にするには、すべての質問を answered_by_customer か withdrawn にしてください（未確認: {', '.join(waiting)}）。")
        for item in unchecked_items:
            report.error(f"approved にするには顧客への確認事項をすべてチェックしてください（未チェック: {item}）。")
    if open_qs and level == STATUSES.index("clarifying"):
        report.warn(f"open の質問が残っています: {', '.join(open_qs)}")

    # 分割判定
    split_hint = "ユーザーに分割を提案してください（要件の統合で警告を消さないこと）。"
    if len(requirements) > SPLIT_MAX_REQS:
        report.warn(f"要件が {len(requirements)} 件あります（目安: {SPLIT_MAX_REQS} 件以下）。{split_hint}")
    if len(capabilities) > SPLIT_MAX_CAPS:
        report.warn(f"業務領域が {len(capabilities)} 個あります（目安: {SPLIT_MAX_CAPS} 個以下）。{split_hint}")

    cross_check(path, text, fm, level, scan_branches, report)

    return report, effective


def main():
    parser = argparse.ArgumentParser(description="requirements.md を検査する")
    parser.add_argument("path", type=Path)
    parser.add_argument("--target", choices=STATUSES, help="この status に進める状態かを検査する")
    parser.add_argument("--no-branches", action="store_true", help="リモートブランチの確認を省略する")
    args = parser.parse_args()

    if not args.path.is_file():
        print(f"ファイルが見つかりません: {args.path}", file=sys.stderr)
        return 2

    report, effective = check(args.path, args.target, not args.no_branches)
    for msg in report.errors:
        print(f"ERROR: {msg}")
    for msg in report.warnings:
        print(f"WARN: {msg}")
    label = f"（検査基準: {effective}）" if effective else ""
    print(f"結果{label}: エラー {len(report.errors)} 件 / 警告 {len(report.warnings)} 件")
    return 1 if report.errors else 0


if __name__ == "__main__":
    sys.exit(main())
