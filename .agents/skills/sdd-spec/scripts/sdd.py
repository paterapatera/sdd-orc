#!/usr/bin/env python3
"""Deterministic next-step for /sdd-spec.

  python3 .agents/skills/sdd-spec/scripts/sdd.py next <feature> [--root DIR]
      [--flow requirements-update|design-update|impl]
      [--speed light|normal] [--ack] [--force]
      [--allow-incomplete] [--allow-upstream]

Speed is light or normal. Path is none, update, or new.
A requirements review and a design review each happen once.
The human gate is `awaiting` until the next invocation passes --ack.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path

FEATURE_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]*$")
TASK_RE = re.compile(r"^- \[[ xX]\]\*? +\d+(?:\.\d+)?\b", re.M)
OPEN_TASK_RE = re.compile(r"^- \[ \]\*? +\d+(?:\.\d+)?\b", re.M)
HASH_RE = re.compile(r"\b([0-9a-fA-F]{64})\b")
VERDICT_RE = re.compile(
    r"VERDICT:\**\s*(GO|NO-GO|READY|WAITING|BLOCKED|MANUAL_VERIFY_REQUIRED|APPROVED)\b",
    re.I,
)
PATH_RE = re.compile(r"\*\*Path\*\*:\s*(none|update|new)\b", re.I)
SPEED_RE = re.compile(r"\*\*Speed\*\*:\s*(light|normal)\b", re.I)
SCALE_RE = re.compile(r"\*\*Scale\*\*:\s*large\b", re.I)
TBD_RE = re.compile(r"\b(TBD|TODO|FIXME|XXX)\b")
SECRET_RE = re.compile(
    r"(?i)(?:api[_-]?key|secret|password|token)\s*[:=]\s*\S+"
    r"|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----"
)
EARS_RE = re.compile(r"\b(When|If|While|Where|shall)\b")
OPEN_LIST_RE = re.compile(r"など|等も|\betc\b|\bor similar\b", re.I)
RESIDUAL_OK_RE = re.compile(r"^(なし|該当なし|none|n/?a)$", re.I)
QUALITY_KEYS = ("functional", "reliability", "usability", "performance", "maintainability", "security")
CHECK_KEYS = ("leakage", "destruction", "lockout", "rewrite")
CHECK_OBSERVABLE = {
    "leakage": re.compile(r"表示しない|見えない|変更できない|削除できない|保存されない"),
    "destruction": re.compile(r"戻せ|残る|消える|保存されない|一件"),
    "lockout": re.compile(r"理由|伝わり|続け"),
    "rewrite": re.compile(r"識別|後から変えても"),
}
ACTION_START_RE = re.compile(r"(?:追加|編集|削除|登録)(?:できる|する)")
DELETE_ACTION_RE = re.compile(r"削除(?:できる|する)")
PLACE_RE = re.compile(r"一覧|詳細|画面|ページ")
NEW_SCREEN_RE = re.compile(r"新しい画面(?!は無)|新規の?画面|新しいページ")
SCREEN_KEYS = ("from", "items", "goes", "failure")
SCREEN_OBSERVABLE = {
    "from": re.compile(r"開く|移る|遷移|戻る"),
    "items": re.compile(r"並ぶ|並べ|項目|表示|入力|見せ"),
    "goes": re.compile(r"開く|戻る|のまま|遷移|移る"),
    "failure": re.compile(r"理由"),
}
UNDO_RE = re.compile(r"戻せ|復元|消えたまま")
QUANTITY_RE = re.compile(r"\d+(?:\.\d+)?\s*(?:秒|件|回|日|時間|分)")
MECHANISM_RE = re.compile(r"(?<!\d)(?:401|403|404|302|500)(?!\d)|物理削除|論理削除")
QUALITY_LINE_RE = re.compile(r"^- (?P<key>[a-z]+):[ \t]*(?P<value>.*)$", re.M)
OUT_SOURCE_RE = re.compile(r"\(source:\s*(?:brief|grill:[A-Za-z0-9._-]+|steering/[A-Za-z0-9._/-]+)\)")
REQ_HEADING_RE = re.compile(r"^## (\d+)\.\s", re.M)
CRITERION_RE = re.compile(r"^(\d+)\.\s")
CHOICE_LINE_RE = re.compile(r"^- (?P<id>[DP]-[A-Za-z0-9-]+):\s*(?P<label>.+?)\s*$", re.M)
SPLIT_LINE_RE = re.compile(r"^- (?P<name>[A-Za-z0-9][A-Za-z0-9._-]*):", re.M)
REQ_GAP_RE = re.compile(r"requirements gap|要求の穴", re.I)
REVIEW_DOMAINS = (
    "traceability",
    "roadmap",
    "failures",
    "privacy",
    "abuse",
    "steering-security",
    "operability",
    "compliance",
    "template",
    "fixes",
)
REVIEW_SPECIALISTS = ("PO", "QA", "Sec")
DESIGN_DOMAINS = (
    "traceability",
    "edges",
    "preconditions",
    "tests",
    "structure",
    "adr",
    "surface",
    "fixes",
)
DESIGN_SPECIALISTS = ("QA", "Arch", "Sec")
AUDIT_VALUE_RE = re.compile(r"^(?:pass|finding|N/A):\s+\S")
ISOLATED = {
    "grill-req",
    "split-brief",
    "spec-requirements",
    "review-requirements",
    "spec-design",
    "review-design",
    "spec-tasks",
    "spec-quick",
}
ROADMAP_LINE_RE = re.compile(
    r"^- \[(?P<done>[ xX])\]\s+(?P<name>\S+)\s+--\s+.*?Dependencies:\s*(?P<deps>.+?)\s*$"
)


def sha256_file(path: Path) -> str | None:
    if not path.is_file():
        return None
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(65536), b""):
            digest.update(chunk)
    return digest.hexdigest()


def read_text(path: Path) -> str | None:
    if not path.is_file():
        return None
    return path.read_text(encoding="utf-8")


def load_json(path: Path) -> dict | None:
    if not path.is_file():
        return None
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ValueError("spec.json must be an object")
    return data


def labeled_hash(text: str | None, label: str) -> str | None:
    """Return the hex recorded for `label`, or None when the field is absent."""
    if text is None:
        return None
    pattern = re.compile(rf"{re.escape(label)}:\**\s*([0-9a-fA-F]{{64}})\b", re.I)
    match = pattern.search(text)
    return match.group(1).lower() if match else None


def first_verdict(text: str | None) -> str | None:
    if not text:
        return None
    match = VERDICT_RE.search(text)
    return match.group(1).upper() if match else None


def phase_gate_status(text: str | None) -> str | None:
    if not text:
        return None
    parts = re.split(r"^## Phase Gate\s*$", text, maxsplit=1, flags=re.M)
    if len(parts) < 2:
        return None
    match = re.search(r"STATUS:\**\s*([A-Z_]+)", parts[1], re.I)
    return match.group(1).upper() if match else None


def section(text: str, heading: str) -> str:
    match = re.search(rf"^## {re.escape(heading)}\s*$", text, re.M)
    if not match:
        return ""
    rest = text[match.end() :]
    nxt = re.search(r"^## ", rest, re.M)
    return rest[: nxt.start()] if nxt else rest


def audit_missing(review: str | None, domains: tuple[str, ...], specialists: tuple[str, ...]) -> bool:
    """A GO review still owes one reasoned line per domain and one judgment per specialist."""
    if not review:
        return True
    evidence = {
        match.group(1): match.group(2).strip()
        for match in re.finditer(r"^- ([a-z-]+):\s*(.+)$", section(review, "Evidence"), re.M)
    }
    if any(AUDIT_VALUE_RE.match(evidence.get(key, "")) is None for key in domains):
        return True
    body = section(review, "Specialists")
    for name in specialists:
        match = re.search(rf"^### {name}\s*$", body, re.M)
        if not match:
            return True
        rest = body[match.end() :]
        nxt = re.search(r"^### ", rest, re.M)
        chunk = rest[: nxt.start()] if nxt else rest
        if not re.search(r"(?m)^- (?:pass|finding):\s+\S", chunk):
            return True
    return False


MEANING_KEYS = (
    "functional",
    "reliability",
    "usability",
    "performance",
    "maintainability",
    "security",
    "leakage",
    "destruction",
    "lockout",
    "rewrite",
    "place",
    "lists",
    "boundary",
)


def meaning_audit_missing(review: str | None, requirements: str | None = None) -> bool:
    """The review owes one AI judgment per quality, check, start place, and kept-item list. The words are not graded."""
    if not review:
        return True
    lines = {
        match.group(1): match.group(2).strip()
        for match in re.finditer(r"^- ([a-z]+):\s*(.+)$", section(review, "Meaning"), re.M)
    }
    if any(AUDIT_VALUE_RE.match(lines.get(key, "")) is None for key in MEANING_KEYS):
        return True
    return judgments_lack_quotes(review, "Meaning", requirements)


def review_audit_missing(review: str | None, requirements: str | None = None) -> bool:
    return audit_missing(review, REVIEW_DOMAINS, REVIEW_SPECIALISTS) or meaning_audit_missing(review, requirements)


def squash(text: str) -> str:
    return re.sub(r"\s+", "", text or "")


def judgments_lack_quotes(review: str | None, heading: str, corpus: str | None) -> bool:
    """A pass or finding that does not quote the artifact is not a finished judgment. N/A needs no quote."""
    if corpus is None:
        return False
    flat = squash(corpus)
    for match in re.finditer(r"^- [a-z-]+:\s*(.+)$", section(review or "", heading), re.M):
        value = match.group(1).strip()
        if value.startswith("N/A:"):
            continue
        quotes = re.findall(r'"([^"]+)"', value)
        if not quotes or any(squash(quote) not in flat for quote in quotes):
            return True
    return False


def design_audit_missing(review: str | None, corpus: str | None = None) -> bool:
    return audit_missing(review, DESIGN_DOMAINS, DESIGN_SPECIALISTS) or judgments_lack_quotes(review, "Evidence", corpus)


def boundary_out_lines(requirements: str | None) -> list[str]:
    """A Boundary out without a brief, grill, or steering source is not a scope exclusion."""
    body = section(requirements or "", "Boundary")
    return [
        match.group(0).strip()
        for match in re.finditer(r"^- out:.*$", body, re.M)
        if not OUT_SOURCE_RE.search(match.group(0))
    ]


def review_next(review: str | None) -> str | None:
    """The design review names where a NO-GO returns. The prose is not searched."""
    match = re.search(r"^- next:\s*(grill|design)\s*$", section(review or "", "Route"), re.M)
    return match.group(1) if match else None


def accepted_residual_lines(review: str | None) -> list[str]:
    """Bullets under Accepted residual risks. 「なし」 and an empty section settle nothing extra."""
    body = section(review or "", "Approval summary")
    match = re.search(r"^### Accepted residual risks\s*$", body, re.M)
    if not match:
        return []
    rest = body[match.end() :]
    nxt = re.search(r"^### ", rest, re.M)
    chunk = rest[: nxt.start()] if nxt else rest
    lines = []
    for raw in chunk.splitlines():
        item = re.match(r"^[-*]\s+(.*\S)\s*$", raw)
        if not item:
            continue
        text = re.sub(r"[*_`]", "", item.group(1)).strip()
        if RESIDUAL_OK_RE.fullmatch(text):
            continue
        lines.append(text)
    return lines


def parse_task_records(tasks_text: str | None) -> list[dict] | None:
    """Return task objects from a ```json fence, or None for a legacy checkbox file."""
    if not tasks_text:
        return None
    fence = re.search(r"```json\s*", tasks_text)
    blob = tasks_text[fence.end() :] if fence else tasks_text
    blob = blob.lstrip()
    if not blob.startswith("{"):
        return None
    try:
        data, _end = json.JSONDecoder().raw_decode(blob)
    except json.JSONDecodeError:
        return None
    if not isinstance(data, dict):
        return None
    tasks = data.get("tasks")
    if not isinstance(tasks, list):
        return None
    return [item for item in tasks if isinstance(item, dict)]


def has_task(tasks_text: str | None) -> bool:
    records = parse_task_records(tasks_text)
    if records is not None:
        return len(records) > 0
    return bool(tasks_text and TASK_RE.search(tasks_text))


def has_open_task(tasks_text: str | None) -> bool:
    records = parse_task_records(tasks_text)
    if records is not None:
        return any(item.get("status") != "done" for item in records)
    return bool(tasks_text and OPEN_TASK_RE.search(tasks_text))


def has_blocked(tasks_text: str | None) -> bool:
    records = parse_task_records(tasks_text)
    if records is not None:
        return any(bool(item.get("blocked")) for item in records)
    return bool(tasks_text and "_Blocked:" in tasks_text)


def has_open_question(requirements: str | None) -> bool:
    return bool(requirements and "Open question:" in requirements)


def rounds_exhausted(text: str | None) -> bool:
    if not text:
        return False
    ai = re.search(r"^AI round:\s*(\d+)\s*$", text, re.M)
    human = re.search(r"^Human round:\s*(\d+)\s*$", text, re.M)
    return bool(ai and int(ai.group(1)) >= 10 and human and int(human.group(1)) >= 10)


def route_path(brief: str | None, spec: dict | None = None) -> str | None:
    if spec and spec.get("path") in {"none", "update", "new"}:
        return spec["path"]
    if not brief:
        return None
    match = PATH_RE.search(brief)
    return match.group(1).lower() if match else None


def generated(spec: dict | None, phase: str) -> bool:
    if not spec:
        return False
    approvals = spec.get("approvals") or {}
    bucket = approvals.get(phase) or {}
    return bucket.get("generated") is True


def source_hash(spec: dict | None, key: str) -> str | None:
    if not spec:
        return None
    source = spec.get("source_sha256") or {}
    value = source.get(key)
    if isinstance(value, str) and HASH_RE.fullmatch(value.strip()):
        return value.strip().lower()
    return None


KANJI_SCREEN_RE = re.compile(r"[一-龯ァ-ヴー]{1,16}画面")
MOVE_VERB_RE = re.compile(r"移る|開く|戻る")
MOVE_MARK_RE = re.compile(r"移る|開く|戻る|へ")
BARE_DEST_RE = re.compile(r"(一覧|詳細|ページ)(?:を開く|に移る|に戻る|へ移る|へ戻る)")
HUMAN_CHOICE_RE = re.compile(r"^- (?P<id>[A-Za-z0-9][A-Za-z0-9._-]*):\s*(?P<label>.+)\s*$", re.M)


def human_choice_labels(grill: str | None) -> list[str]:
    body = section(grill or "", "Human choices")
    return [match.group("label").strip() for match in HUMAN_CHOICE_RE.finditer(body)]


def alignment_sources(grill: str | None, brief: str | None) -> list[str]:
    return [text for text in [brief or "", *human_choice_labels(grill)] if text.strip()]


def covers_name(sources: list[str], token: str) -> bool:
    names = {token}
    if token.endswith("画面") and len(token) > 2:
        names.add(token[:-2])
    return any(any(len(name) >= 2 and name in src for name in names) for src in sources)


def place_mentions(line: str) -> list[tuple[str, bool]]:
    """(token, is_destination). A move with no named place is the token 行き先."""
    mentions: list[tuple[str, bool]] = []
    for match in KANJI_SCREEN_RE.finditer(line):
        after = line[match.end() : match.end() + 8]
        mentions.append((match.group(0), bool(re.match(r"(?:に|へ)(?:移る|戻る)|を開く", after))))
    for match in BARE_DEST_RE.finditer(line):
        mentions.append((match.group(1), True))
    if MOVE_VERB_RE.search(line) and not any(is_move for _, is_move in mentions):
        mentions.append(("行き先", True))
    return mentions


def unaligned_places(requirements: str | None, grill: str | None, brief: str | None) -> list[str]:
    """Places and destinations the requirements state that the human has not said."""
    sources = alignment_sources(grill, brief)
    missing: list[str] = []
    for name in re.findall(r"^###\s+(\S+)\s*$", section(requirements or "", "Screens"), re.M):
        named = name in sources or any(name in src for src in sources)
        long_enough = len(name) >= 3 or name.endswith("画面")
        screened = any((name + "画面") in src for src in sources)
        if not (named and (long_enough or screened)):
            missing.append(name)
    for line in criterion_lines(requirements or "").values():
        for token, is_move in place_mentions(line):
            if token == "行き先":
                missing.append(token)
                continue
            covered = covers_name(sources, token) and (not is_move or any(MOVE_MARK_RE.search(src) and covers_name([src], token) for src in sources))
            if not covered:
                missing.append(token)
    return list(dict.fromkeys(missing))


def grill_state(text: str | None, target_hash: str | None) -> str:
    """ready, stale, waiting, or blocked. A missing hash is stale."""
    if text is None or target_hash is None:
        return "missing"
    verdict = first_verdict(text)
    recorded = labeled_hash(text, "Target SHA256")
    if verdict == "BLOCKED" and recorded == target_hash:
        return "blocked"
    if verdict == "WAITING" and recorded == target_hash:
        return "waiting"
    if verdict == "READY" and recorded == target_hash:
        return "ready"
    return "stale"


def findings_rollback_grill(review: str | None) -> bool:
    if not review or first_verdict(review) != "NO-GO":
        return False
    findings = section(review, "Findings")
    return bool(
        re.search(r"(rollback|巻き戻し).{0,80}\bgrill\b", findings, re.I | re.S)
        or re.search(r"\bgrill\b.{0,40}(rollback|巻き戻し)", findings, re.I | re.S)
    )


def split_names(req_grill: str | None) -> list[str]:
    if not req_grill:
        return []
    return [match.group("name") for match in SPLIT_LINE_RE.finditer(section(req_grill, "Split"))]


def design_names_req_gap(review: str | None) -> bool:
    if not review or first_verdict(review) != "NO-GO":
        return False
    return bool(REQ_GAP_RE.search(section(review, "Findings")))


def parse_roadmap(text: str | None) -> dict[str, dict]:
    if not text:
        return {}
    entries: dict[str, dict] = {}
    active = False
    for line in text.splitlines():
        if line.startswith("## "):
            title = line[3:].strip()
            active = title in {"Specs (dependency order)", "Existing Spec Updates"}
            continue
        if not active:
            continue
        match = ROADMAP_LINE_RE.match(line.strip())
        if not match:
            continue
        deps_raw = match.group("deps").strip()
        if not deps_raw or deps_raw.lower() == "none":
            deps: list[str] = []
        else:
            deps = [part.strip() for part in deps_raw.split(",") if part.strip() and part.strip().lower() != "none"]
        entries[match.group("name")] = {"done": match.group("done").lower() == "x", "deps": deps}
    return entries


def decision(
    action: str,
    phase: str,
    reason: str,
    *,
    feature: str,
    skill: str | None = None,
    args: list[str] | None = None,
    mode: str | None = None,
    mutations: list | None = None,
    gate: dict | None = None,
    details: dict | None = None,
) -> dict:
    return {
        "feature": feature,
        "action": action,
        "phase": phase,
        "reason": reason,
        "skill": skill,
        "args": args or [],
        "mode": mode,
        "mutations": mutations or [],
        "gate": gate,
        "details": details or {},
        "isolate": action in ISOLATED,
    }


def mechanical_findings(kind: str, text: str | None) -> list[str]:
    """Executable checks that run before a judgment review."""
    body = text or ""
    found: list[str] = []
    if TBD_RE.search(body):
        found.append("tbd")
    if SECRET_RE.search(body):
        found.append("secret")
    if "Boundary Candidates" in body or "境界未定" in body:
        found.append("boundary")
    if re.search(r"\bRED\b", body):
        found.append("red")
    if kind == "requirements" and not EARS_RE.search(body):
        found.append("test")
    if kind == "design" and any(not isinstance(item.get("reversible"), bool) for item in record_decisions(body)):
        found.append("reversible")
    return found


def criterion_ids(requirements: str) -> set[str]:
    """`<req>.<n>` for each numbered line under a `## <req>.` heading."""
    ids: set[str] = set()
    current: str | None = None
    for line in requirements.splitlines():
        heading = REQ_HEADING_RE.match(line)
        if heading:
            current = heading.group(1)
            continue
        if line.startswith("## "):
            current = None
            continue
        item = CRITERION_RE.match(line)
        if current and item:
            ids.add(f"{current}.{item.group(1)}")
    return ids


def requirement_ids(requirements: str | None) -> set[str]:
    return {match.group(1) for match in REQ_HEADING_RE.finditer(requirements or "")}


def quality_gaps(requirements: str) -> list[str]:
    """Characteristics whose `## Quality` line is missing or not settled by criteria, a sourced out, or an open question."""
    body = section(requirements, "Quality")
    lines = {}
    for match in QUALITY_LINE_RE.finditer(body):
        lines[match.group("key")] = match.group("value").strip()
    known = criterion_ids(requirements)
    gaps = []
    for key in QUALITY_KEYS:
        value = lines.get(key, "")
        parts = [part.strip() for part in value.split(";") if part.strip()]
        if not parts or not all(quality_part_ok(part, known) for part in parts):
            gaps.append(key)
    return gaps


def criterion_lines(requirements: str) -> dict[str, str]:
    texts: dict[str, str] = {}
    current: str | None = None
    for line in requirements.splitlines():
        heading = REQ_HEADING_RE.match(line)
        if heading:
            current = heading.group(1)
            continue
        if line.startswith("## "):
            current = None
            continue
        item = CRITERION_RE.match(line)
        if current and item:
            texts[f"{current}.{item.group(1)}"] = line
    return texts


def check_gaps(requirements: str) -> list[str]:
    """Four failures whose `## Checks` line is missing, or whose criterion would not fail the bad implementation."""
    body = section(requirements, "Checks")
    lines = {}
    for match in QUALITY_LINE_RE.finditer(body):
        lines[match.group("key")] = match.group("value").strip()
    texts = criterion_lines(requirements)
    gaps = []
    for key in CHECK_KEYS:
        value = lines.get(key, "")
        parts = [part.strip() for part in value.split(";") if part.strip()]
        if not parts or not all(check_part_ok(part, texts, CHECK_OBSERVABLE[key]) for part in parts):
            gaps.append(key)
        elif key == "destruction" and destruction_undo_gap(value, texts):
            gaps.append(key)
    return gaps


NAMED_OPENER_RE = re.compile(r"リンク|メール")


def arrival_line(line: str, name: str) -> bool:
    """The line names a different place, or a link the human named, that opens this screen."""
    if not SCREEN_OBSERVABLE["from"].search(line):
        return False
    if name and name not in line and f"{name}画面" not in line:
        return False
    if NAMED_OPENER_RE.search(line):
        return True
    for match in KANJI_SCREEN_RE.finditer(line):
        token = match.group(0)
        bare = token[:-2] if token.endswith("画面") else token
        if bare != name and token != name:
            return True
    for match in BARE_DEST_RE.finditer(line):
        if match.group(1) not in name:
            return True
    return False


def from_chosen(name: str, part: str, grill: str | None, brief: str | None) -> bool:
    """A missing grill means the criterion text is the only evidence. A grill requires one human source."""
    if grill is None and brief is None:
        return True
    return any(arrival_line(src, name) for src in alignment_sources(grill, brief))


def screen_questions(requirements: str, grill: str | None = None, brief: str | None = None) -> list[str]:
    """Screen lines the human has not settled. These go back to the grill, not to a rewrite."""
    body = section(requirements, "Screens")
    if not body.strip():
        return ["Screens"]
    texts = criterion_lines(requirements)
    blocks = re.split(r"^### ", body, flags=re.M)
    if len(blocks) > 1:
        pending: list[str] = []
        for block in blocks[1:]:
            name = block.splitlines()[0].strip() or "screen"
            lines = {match.group("key"): match.group("value").strip() for match in QUALITY_LINE_RE.finditer(block)}
            pending.extend(
                f"{name}.{key}"
                for key in SCREEN_KEYS
                if not screen_part_ok(lines.get(key, ""), texts, key, name, grill, brief)
            )
        return pending
    if "Open question:" in blocks[0]:
        return []
    if any(NEW_SCREEN_RE.search(line) for line in texts.values()):
        return ["Screens"]
    entries = list(QUALITY_LINE_RE.finditer(blocks[0]))
    if not entries or not all(match.group("key") == "out" and bool(OUT_SOURCE_RE.search(match.group(0))) for match in entries):
        return ["Screens"]
    return []


def screen_gaps(requirements: str) -> bool:
    """A new screen is unsettled until its arrival, items, destinations, and failure place are criteria."""
    return bool(screen_questions(requirements))


def screen_part_ok(
    part: str,
    texts: dict[str, str],
    key: str,
    name: str = "",
    grill: str | None = None,
    brief: str | None = None,
) -> bool:
    if part.startswith("Open question:"):
        return len(part) > len("Open question:")
    if key == "from" and part.startswith("out:"):
        return bool(OUT_SOURCE_RE.search(part)) and arrival_line(part, name) and from_chosen(name, part, grill, brief)
    if part.startswith("criteria:"):
        refs = [ref.strip() for ref in part[len("criteria:") :].split(",") if ref.strip()]
        if not refs or any(ref not in texts for ref in refs):
            return False
        line = " ".join(texts[ref] for ref in refs)
        if key == "from":
            return arrival_line(line, name) and from_chosen(name, part, grill, brief)
        if not SCREEN_OBSERVABLE[key].search(line):
            return False
        if key == "items" and OPEN_LIST_RE.search(line):
            return False
        if key == "goes" and not PLACE_RE.search(line):
            return False
        if key == "failure" and not (PLACE_RE.search(line) or "のまま" in line):
            return False
        return True
    return False


def quality_value(requirements: str, key: str) -> str:
    body = section(requirements, "Quality")
    for match in QUALITY_LINE_RE.finditer(body):
        if match.group("key") == key:
            return match.group("value").strip()
    return ""


def place_gaps(requirements: str) -> bool:
    """An action the user can start is unsettled until that same line names the visible place."""
    missing = [line for line in criterion_lines(requirements).values() if ACTION_START_RE.search(line) and not PLACE_RE.search(line)]
    if not missing:
        return False
    usability = quality_value(requirements, "usability")
    if "Open question:" in usability:
        return False
    return True


def destruction_undo_gap(value: str, texts: dict[str, str]) -> bool:
    """A removal is not settled by another line that only says the failed value is not stored."""
    if not any(DELETE_ACTION_RE.search(line) for line in texts.values()):
        return False
    if value.startswith("Open question:"):
        return False
    if value.startswith("out:"):
        return UNDO_RE.search(value) is None
    refs = [ref.strip() for ref in value[len("criteria:") :].split(",") if ref.strip()] if value.startswith("criteria:") else []
    return not any(DELETE_ACTION_RE.search(texts.get(ref, "")) and UNDO_RE.search(texts.get(ref, "")) for ref in refs)


def quantity_tokens(text: str) -> set[str]:
    return {match.group(0).replace(" ", "") for match in QUANTITY_RE.finditer(text or "")}


def quantity_in(text: str, token: str) -> bool:
    return re.search(rf"(?<!\d){re.escape(token)}", (text or "").replace(" ", "")) is not None


def false_requirements_basis(requirements: str | None, design: str | None) -> list[str]:
    """Status codes, physical deletion, and quantities the requirements text does not contain."""
    req = requirements or ""
    claims: set[str] = set()
    for item in record_decisions(design):
        if item.get("basis") != "requirements":
            continue
        choose = str(item.get("choose") or "")
        for token in list(MECHANISM_RE.findall(choose)) + list(quantity_tokens(choose)):
            if not quantity_in(req, token) and token not in req:
                claims.add(token)
    covered = set()
    for item in record_decisions(design):
        if item.get("basis") in {"recommendation", "human"}:
            choose = str(item.get("choose") or "")
            covered.update(MECHANISM_RE.findall(choose))
    for token in MECHANISM_RE.findall(design or ""):
        if token not in req and token not in covered:
            claims.add(token)
    return sorted(claims)


def untranscribed_limits(requirements: str | None, design: str | None, grill: str | None) -> list[str]:
    """A number a human already chose counts only when the criterion text contains it."""
    req = requirements or ""
    found: set[str] = set()
    for item in record_decisions(design):
        if item.get("basis") == "human":
            found.update(quantity_tokens(str(item.get("choose") or "")))
    for label in section_labels(grill, "Human choices").values():
        found.update(quantity_tokens(label))
    return sorted(token for token in found if not quantity_in(req, token))


def check_part_ok(part: str, texts: dict[str, str], observable: re.Pattern[str]) -> bool:
    if part.startswith("Open question:"):
        return len(part) > len("Open question:")
    if part.startswith("out:"):
        return bool(OUT_SOURCE_RE.search(part))
    if part.startswith("criteria:"):
        refs = [ref.strip() for ref in part[len("criteria:") :].split(",") if ref.strip()]
        return bool(refs) and all(ref in texts for ref in refs) and any(observable.search(texts[ref]) for ref in refs)
    return False


def quality_part_ok(part: str, known: set[str]) -> bool:
    if part.startswith("Open question:"):
        return len(part) > len("Open question:")
    if part.startswith("out:"):
        return bool(OUT_SOURCE_RE.search(part))
    if part.startswith("criteria:"):
        refs = [ref.strip() for ref in part[len("criteria:") :].split(",") if ref.strip()]
        return bool(refs) and all(ref in known for ref in refs)
    return False


def record_json(design: str | None) -> dict | None:
    if not design:
        return None
    body = section(design, "Record")
    fence = re.search(r"```json\s*", body)
    if not fence:
        return None
    try:
        data, _end = json.JSONDecoder().raw_decode(body[fence.end() :].lstrip())
    except json.JSONDecodeError:
        return None
    return data if isinstance(data, dict) else None


def record_decisions(design: str | None) -> list[dict]:
    data = record_json(design) or {}
    items = data.get("decisions")
    return [item for item in items if isinstance(item, dict)] if isinstance(items, list) else []


def section_labels(text: str | None, heading: str) -> dict[str, str]:
    body = section(text or "", heading)
    return {match.group("id"): match.group("label").strip() for match in CHOICE_LINE_RE.finditer(body)}


def recommendation_question(item: dict) -> dict:
    alternatives = [part.strip() for part in str(item.get("rejected") or "").split("/") if part.strip()]
    return {
        "id": item.get("id"),
        "prompt": f"推奨は「{item.get('choose')}」で書いてあります。別案もあります。変更しますか？",
        "options": ["このまま（推奨）", *alternatives, "持ち帰る"],
    }


def recommendation_gate(design: str | None, grill: str | None) -> dict | None:
    """Ask before tasks when a decision is only a recommendation."""
    records = [item for item in record_decisions(design) if item.get("basis") == "recommendation"]
    if not records:
        return None
    chosen = section_labels(grill, "Human choices")
    deferred = section_labels(grill, "DEFERRED")
    apply = [item for item in records if item.get("id") in chosen]
    if apply:
        return {
            "action": "spec-design",
            "confirm": [{"id": item.get("id"), "label": chosen[item.get("id")]} for item in apply],
        }
    pending = [item for item in records if item.get("id") not in chosen and item.get("id") not in deferred]
    if pending:
        return {"action": "needs-choice", "questions": [recommendation_question(item) for item in pending]}
    return {"action": "stop-design-deferred", "ids": [item.get("id") for item in records if item.get("id") in deferred]}


def physical_decisions(tasks: str | None) -> list[dict]:
    found: list[dict] = []
    for item in parse_task_records(tasks) or []:
        decisions = item.get("physical_decisions")
        if isinstance(decisions, list):
            found.extend(entry for entry in decisions if isinstance(entry, dict))
    return found


def physical_recommendation_gate(tasks: str | None, grill: str | None) -> dict | None:
    """Ask before implementation when a physical shape is only a recommendation."""
    records = [item for item in physical_decisions(tasks) if item.get("basis") == "recommendation"]
    if not records:
        return None
    chosen = section_labels(grill, "Human choices")
    deferred = section_labels(grill, "DEFERRED")
    apply = [item for item in records if item.get("id") in chosen]
    if apply:
        return {
            "action": "spec-tasks",
            "confirm": [{"id": item.get("id"), "label": chosen[item.get("id")]} for item in apply],
        }
    pending = [item for item in records if item.get("id") not in chosen and item.get("id") not in deferred]
    if pending:
        return {"action": "needs-choice", "questions": [recommendation_question(item) for item in pending]}
    return {"action": "stop-tasks-deferred", "ids": [item.get("id") for item in records if item.get("id") in deferred]}


def irreversible_decisions(design: str | None) -> list[dict]:
    return [
        {"id": item.get("id"), "choose": item.get("choose"), "rejected": item.get("rejected")}
        for item in record_decisions(design)
        if item.get("reversible") is False
    ]


def record_files(design: str | None) -> list[str]:
    data = record_json(design) or {}
    items = data.get("files")
    if not isinstance(items, list):
        return []
    return [item["path"] for item in items if isinstance(item, dict) and isinstance(item.get("path"), str) and item["path"]]


def path_covered(path: str, boundaries: list[str]) -> bool:
    return any(path == b or path.startswith(b.rstrip("/") + "/") or b.startswith(path.rstrip("/") + "/") for b in boundaries)


def proposed_speed(brief: str | None, spec: dict | None = None) -> str | None:
    if spec and spec.get("proposed_speed") in {"light", "normal"}:
        return spec["proposed_speed"]
    if not brief:
        return None
    match = SPEED_RE.search(brief)
    return match.group(1).lower() if match else None


def scale_of(brief: str | None, spec: dict | None) -> str | None:
    if spec and spec.get("scale") == "large":
        return "large"
    if brief and SCALE_RE.search(brief):
        return "large"
    return None


def accepted(spec: dict | None, phase: str) -> bool:
    bucket = (spec or {}).get("accepted") or {}
    return bucket.get(phase) is True


def release(spec: dict | None, phase: str, content_hash: str | None = None) -> list[dict]:
    current = dict((spec or {}).get("accepted") or {})
    current[phase] = True
    mutations = [
        {"op": "set", "key": "accepted", "value": current},
        {"op": "set", "key": "awaiting", "value": None},
    ]
    if content_hash is not None:
        hashes = dict((spec or {}).get("accepted_sha256") or {})
        hashes[phase] = content_hash
        mutations.append({"op": "set", "key": "accepted_sha256", "value": hashes})
    return mutations


def accepted_as_is(spec: dict | None, phase: str, content_hash: str | None) -> bool:
    """Accepted, and the file has not changed since. A spec accepted before hashes were recorded stays accepted."""
    if not accepted(spec, phase):
        return False
    recorded = ((spec or {}).get("accepted_sha256") or {}).get(phase)
    return recorded is None or recorded == content_hash


def invalidate_ready(spec: dict | None) -> list[dict]:
    mutations = [{"op": "touch", "key": "updated_at"}]
    if spec is None or spec.get("ready_for_implementation") is not False:
        mutations.insert(0, {"op": "set", "key": "ready_for_implementation", "value": False})
    return mutations


class Repo:
    def __init__(self, root: Path, feature: str):
        self.root = root
        self.feature = feature
        self.spec_dir = root / "docs" / "specs" / feature
        self.brief_path = self.spec_dir / "brief.md"
        self.requirements_path = self.spec_dir / "requirements.md"
        self.design_path = self.spec_dir / "design.md"
        self.tasks_path = self.spec_dir / "tasks.md"
        self.spec_path = self.spec_dir / "spec.json"
        self.brief_grill_path = self.spec_dir / "brief-grill.md"
        self.req_grill_path = self.spec_dir / "req-grill.md"
        self.design_grill_path = self.spec_dir / "design-grill.md"
        self.tasks_grill_path = self.spec_dir / "tasks-grill.md"
        self.req_review_path = self.spec_dir / "reviews" / "requirements-review.md"
        self.design_review_path = self.spec_dir / "reviews" / "design-review.md"
        self.roadmap_path = root / "docs" / "steering" / "roadmap.md"

    def hashes(self) -> dict[str, str | None]:
        return {
            "brief": sha256_file(self.brief_path),
            "requirements": sha256_file(self.requirements_path),
            "design": sha256_file(self.design_path),
        }

    def split_state(self, names: list[str]) -> tuple[list[str], list[str]]:
        """(pending, taken). A name is done when its spec.json says split_from this feature."""
        pending: list[str] = []
        taken: list[str] = []
        for name in names:
            if name == self.feature:
                taken.append(name)
                continue
            target = self.root / "docs" / "specs" / name
            try:
                other = load_json(target / "spec.json")
            except (json.JSONDecodeError, ValueError):
                other = None
            if other and other.get("split_from") == self.feature:
                continue
            if target.exists():
                taken.append(name)
            else:
                pending.append(name)
        return pending, taken


def upstream_blockers(repo: Repo) -> list[dict]:
    roadmap = parse_roadmap(read_text(repo.roadmap_path))
    entry = roadmap.get(repo.feature)
    if entry is None:
        return []
    blockers = []
    for dep in entry["deps"]:
        dep_entry = roadmap.get(dep)
        if dep_entry and dep_entry["done"]:
            continue
        dep_dir = repo.root / "docs" / "specs" / dep
        try:
            dep_spec = load_json(dep_dir / "spec.json")
        except (json.JSONDecodeError, ValueError):
            dep_spec = None
        tasks = read_text(dep_dir / "tasks.md")
        if generated(dep_spec, "tasks") and has_task(tasks):
            continue
        blockers.append(
            {
                "dep": dep,
                "roadmap_done": bool(dep_entry and dep_entry["done"]),
                "tasks_generated": generated(dep_spec, "tasks"),
                "tasks_present": has_task(tasks),
            }
        )
    return blockers


def design_fresh(repo: Repo, spec: dict | None, ready: bool) -> bool:
    req_hash = sha256_file(repo.requirements_path)
    design_hash = sha256_file(repo.design_path)
    review = read_text(repo.design_review_path)
    req_field = labeled_hash(review, "Requirements SHA256")
    design_field = labeled_hash(review, "Design SHA256")
    if ready and req_field is None and design_field is None:
        return True
    if req_field is None or design_field is None:
        return False
    return (
        first_verdict(review) == "GO"
        and phase_gate_status(review) == "VERIFIED"
        and req_field == req_hash
        and design_field == design_hash
        and not accepted_residual_lines(review)
        and not design_audit_missing(review, (read_text(repo.requirements_path) or "") + "\n" + (read_text(repo.design_path) or ""))
    )


def tasks_fresh(spec: dict | None, tasks: str | None, design_hash: str | None, ready: bool) -> bool:
    if not generated(spec, "tasks") or not has_task(tasks):
        return False
    recorded = source_hash(spec, "design_at_tasks")
    if recorded is None:
        return ready
    return recorded == design_hash


def task_gate(
    spec: dict | None,
    tasks: str | None,
    design_hash: str | None,
    design: str | None = None,
    requirements: str | None = None,
) -> dict:
    gaps = []
    if not has_task(tasks):
        gaps.append("1")
    if not generated(spec, "tasks"):
        gaps.append("2")
    recorded = source_hash(spec, "design_at_tasks")
    if recorded is None or recorded != design_hash:
        gaps.append("4")
    records = parse_task_records(tasks)
    uncovered_files: list[str] = []
    uncovered_reqs: list[str] = []
    missing_physical: list[str] = []
    if records is not None:
        boundaries = [b for item in records for b in (item.get("boundary") or []) if isinstance(b, str)]
        uncovered_files = [path for path in record_files(design) if not path_covered(path, boundaries)]
        claimed = {str(r) for item in records for r in (item.get("req") or [])}
        uncovered_reqs = sorted(requirement_ids(requirements) - claimed, key=lambda x: int(x))
        missing_physical = [
            str(item.get("id"))
            for item in records
            if not str(item.get("physical") or "").strip()
        ]
    if uncovered_files:
        gaps.append("5")
    if uncovered_reqs:
        gaps.append("6")
    if missing_physical:
        gaps.append("7")
    blocked = has_blocked(tasks)
    if gaps:
        result = "NOT_VERIFIED"
    elif blocked:
        result = "MANUAL_VERIFY_REQUIRED"
    else:
        result = "VERIFIED"
    if blocked and "3" not in gaps:
        gaps.append("3")
    gate = {"result": result, "gaps": gaps}
    if uncovered_files:
        gate["uncovered_files"] = uncovered_files
    if uncovered_reqs:
        gate["uncovered_reqs"] = uncovered_reqs
    if missing_physical:
        gate["missing_physical"] = missing_physical
    return gate


def requirements_step(repo: Repo, spec: dict | None) -> dict | None:
    """One requirements grill, then one review. None when that block is done."""
    if not repo.requirements_path.is_file() or not generated(spec, "requirements"):
        return {"step": "generate"}
    req_text = read_text(repo.requirements_path)
    req_hash = sha256_file(repo.requirements_path)
    req_grill = read_text(repo.req_grill_path)
    review = read_text(repo.req_review_path)
    recorded_g = labeled_hash(req_grill, "Target SHA256")
    input_hash = labeled_hash(review, "Input SHA256")
    output_hash = labeled_hash(review, "Output SHA256")
    # "not READY" is the verdict. A READY grill whose hash moved is the next clause,
    # and that clause ignores edits validate itself recorded (I = G and O = current).
    verdict_ready = req_grill is not None and first_verdict(req_grill) == "READY"
    validate_owns_edit = recorded_g is not None and input_hash == recorded_g and output_hash == req_hash
    changed_outside_validate = recorded_g != req_hash and not validate_owns_edit
    review_nogo = review is not None and first_verdict(review) == "NO-GO" and output_hash == req_hash
    if not verdict_ready or changed_outside_validate or review_nogo or has_open_question(req_text):
        capped = rounds_exhausted(req_grill) and not changed_outside_validate and not review_nogo
        if capped or (
            grill_state(req_grill, req_hash) == "blocked"
            and not changed_outside_validate
            and not review_nogo
            and not has_open_question(req_text)
        ):
            return {"stop": "req", "file": "req-grill.md"}
        return {"step": "grill", "escalate": has_open_question(req_text)}
    pending, taken = repo.split_state(split_names(req_grill))
    if taken:
        return {"stop": "split", "file": "req-grill.md", "names": taken}
    if pending:
        return {"step": "split", "names": pending}
    if accepted_residual_lines(review) and first_verdict(review) == "GO" and output_hash == req_hash:
        return {"step": "grill", "escalate": True}
    misused = boundary_out_lines(req_text)
    if misused:
        if rounds_exhausted(req_grill) and not changed_outside_validate and not review_nogo:
            return {"stop": "req", "file": "req-grill.md"}
        return {"step": "grill", "escalate": True, "boundary_out": misused}
    findings = mechanical_findings("requirements", req_text)
    if findings:
        return {"step": "fix", "checks": findings}
    verified = (
        review is not None
        and first_verdict(review) == "GO"
        and phase_gate_status(review) == "VERIFIED"
        and output_hash == req_hash
        and not review_audit_missing(review, req_text)
    )
    if verified:
        return None
    return {"step": "review", "checks": []}


def design_action(repo: Repo, spec: dict | None) -> dict:
    review = read_text(repo.design_review_path)
    design_text = read_text(repo.design_path)
    req_hash = sha256_file(repo.requirements_path)
    design_hash = sha256_file(repo.design_path)
    if not repo.design_path.is_file() or not generated(spec, "design"):
        return {"action": "spec-design", "mode": "full", "checks": []}
    misused = boundary_out_lines(read_text(repo.requirements_path))
    if misused:
        return {"action": "grill-req", "mode": None, "checks": [], "boundary_out": misused}
    req_field = labeled_hash(review, "Requirements SHA256")
    design_field = labeled_hash(review, "Design SHA256")
    if review is not None and req_field != req_hash:
        return {"action": "spec-design", "mode": "diff", "checks": []}
    if accepted_residual_lines(review) and first_verdict(review) == "GO" and design_field == design_hash:
        return {"action": "grill-req", "mode": None, "checks": []}
    if first_verdict(review) == "NO-GO" and design_field == design_hash:
        route = review_next(review)
        if route == "grill":
            return {"action": "grill-req", "mode": None, "checks": []}
        if route == "design":
            return {"action": "spec-design", "mode": "diff", "checks": []}
        return {"action": "review-design", "mode": None, "checks": []}
    corpus = (read_text(repo.requirements_path) or "") + "\n" + (design_text or "")
    fresh = (
        first_verdict(review) == "GO"
        and phase_gate_status(review) == "VERIFIED"
        and req_field == req_hash
        and design_field == design_hash
        and design_field is not None
        and not design_audit_missing(review, corpus)
    )
    if fresh:
        return {"action": "design-fresh", "mode": None, "checks": []}
    findings = mechanical_findings("design", design_text)
    if findings:
        return {"action": "spec-design", "mode": "diff", "checks": findings}
    return {"action": "review-design", "mode": None, "checks": []}


def skill_for(action: str, feature: str, mode: str | None) -> tuple[str | None, list[str]]:
    mapping = {
        "grill-req": ("sdd-grill", [feature]),
        "spec-requirements": ("sdd-spec-requirements", [feature]),
        "review-requirements": ("sdd-validate-requirements", [feature]),
        "spec-design": ("sdd-spec-design", [feature]),
        "review-design": ("sdd-validate-design", [feature]),
        "spec-tasks": ("sdd-spec-tasks", [feature]),
        "spec-quick": ("sdd-spec-quick", [feature]),
        "split-brief": ("sdd-new", [feature]),
    }
    skill, args = mapping.get(action, (None, []))
    return skill, args


def with_skill(result: dict, mode: str | None = None) -> dict:
    skill, args = skill_for(result["action"], result["feature"], mode)
    result["skill"] = skill
    result["args"] = args
    if mode is not None:
        result["mode"] = mode
    return result


def gate_followup(repo: Repo, spec: dict | None, feature: str, mutations: list) -> dict:
    tasks = read_text(repo.tasks_path)
    design_hash = sha256_file(repo.design_path)
    gate = task_gate(spec, tasks, design_hash, read_text(repo.design_path), read_text(repo.requirements_path))
    if gate["result"] == "VERIFIED":
        advice = physical_recommendation_gate(tasks, read_text(repo.tasks_grill_path))
        if advice and advice["action"] == "spec-tasks":
            return with_skill(
                decision(
                    "spec-tasks",
                    "tasks",
                    "物理設計への回答をタスクに反映する",
                    feature=feature,
                    mutations=mutations,
                    mode="diff",
                    details={"confirm": advice["confirm"]},
                ),
                "diff",
            )
        if advice and advice["action"] == "needs-choice":
            return decision(
                "needs-choice",
                "tasks",
                "design.md から判断できない物理設計がある。変更するか聞く",
                feature=feature,
                mutations=mutations,
                details={"questions": advice["questions"]},
            )
        if advice and advice["action"] == "stop-tasks-deferred":
            return decision(
                "stop-tasks-deferred",
                "tasks",
                "物理設計の推奨が持ち帰りになっている。確認がつくまで実装へ進まない",
                feature=feature,
                mutations=mutations,
                details={"ids": advice["ids"]},
            )
        mutations = list(mutations) + [
            {"op": "set", "key": "ready_for_implementation", "value": True},
            {"op": "set", "key": "phase", "value": "tasks-approved"},
        ]
        return decision(
            "auto-approve",
            "tasks",
            "タスクゲートが VERIFIED。ready_for_implementation を立て、PR Summary を出して終了する",
            feature=feature,
            mutations=mutations,
            gate=gate,
        )
    if gate["result"] == "MANUAL_VERIFY_REQUIRED":
        return decision(
            "stop-manual",
            "tasks",
            "タスクに blocked がある。人間の判断が要る",
            feature=feature,
            mutations=mutations,
            gate=gate,
        )
    return with_skill(
        decision(
            "spec-tasks",
            "tasks",
            "タスクゲートが NOT_VERIFIED。tasks をやり直す",
            feature=feature,
            mutations=mutations,
            gate=gate,
            mode=None,
        )
    )


def emit_design(repo: Repo, spec: dict | None, feature: str, mutations: list, picked: dict, reason: str) -> dict:
    if picked["action"] == "grill-req":
        if picked.get("boundary_out"):
            return with_skill(
                decision(
                    "grill-req",
                    "requirements",
                    "Boundary の out は機能の対象外だけを書く。設計の決定はここに載せない",
                    feature=feature,
                    mutations=mutations,
                    details={"boundary_out": picked["boundary_out"]},
                )
            )
        return with_skill(
            decision(
                "grill-req",
                "requirements",
                "設計レビューが要求の穴を見つけた。要求の grill に戻る",
                feature=feature,
                mutations=mutations,
                details={"design_review": "reviews/design-review.md"},
            )
        )
    details = {"mode": picked["mode"], "checks": picked.get("checks") or []}
    if picked.get("claims"):
        details["claims"] = picked["claims"]
    return with_skill(
        decision(
            picked["action"],
            "design",
            reason,
            feature=feature,
            mutations=mutations,
            mode=picked["mode"],
            details=details,
        ),
        picked["mode"],
    )


def from_design(
    repo: Repo,
    spec: dict | None,
    feature: str,
    mutations: list,
    *,
    design_is_fresh: bool,
    scale: str | None,
    ack: bool,
) -> dict:
    if not design_is_fresh:
        picked = design_action(repo, spec)
        if picked["checks"]:
            reason = "機械チェックが失敗した。レビューは始めない"
        elif picked["action"] == "spec-design":
            reason = "設計が未生成、または要求ハッシュがレビューと一致しない"
        else:
            reason = "設計レビューが無い、VERIFIED ではない、または design ハッシュが一致しない"
        return emit_design(repo, spec, feature, mutations, picked, reason)
    advice = recommendation_gate(read_text(repo.design_path), read_text(repo.design_grill_path))
    if advice and advice["action"] == "spec-design":
        return with_skill(
            decision(
                "spec-design",
                "design",
                "推奨案への回答を設計に反映する",
                feature=feature,
                mutations=mutations,
                mode="diff",
                details={"confirm": advice["confirm"]},
            ),
            "diff",
        )
    if advice and advice["action"] == "needs-choice":
        return decision(
            "needs-choice",
            "design",
            "要件から判断できない推奨案がある。変更するか聞く",
            feature=feature,
            mutations=mutations,
            details={"questions": advice["questions"]},
        )
    if advice and advice["action"] == "stop-design-deferred":
        return decision(
            "stop-design-deferred",
            "design",
            "推奨案が持ち帰りになっている。確認がつくまでタスクへ進まない",
            feature=feature,
            mutations=mutations,
            details={"ids": advice["ids"]},
        )
    design_hash_now = sha256_file(repo.design_path)
    irreversible = irreversible_decisions(read_text(repo.design_path))
    if (scale == "large" or irreversible) and not accepted_as_is(spec, "design", design_hash_now):
        if ack and (spec or {}).get("awaiting") == "design":
            mutations = list(mutations) + release(spec, "design", design_hash_now)
        else:
            if irreversible:
                reason = "戻しにくい設計判断がある。設計の確認で止まる。次の /sdd-spec が --ack でタスクへ進む"
            else:
                reason = "規模が大きい。設計の確認で止まる。次の /sdd-spec が --ack でタスクへ進む"
            return decision(
                "phase-terminal",
                "design",
                reason,
                feature=feature,
                mutations=list(mutations) + [{"op": "set", "key": "awaiting", "value": "design"}],
                details={"template": "phase-handoff", "irreversible": irreversible},
            )
    tasks = read_text(repo.tasks_path)
    design_hash = sha256_file(repo.design_path)
    ready = bool(spec and spec.get("ready_for_implementation") is True)
    if not tasks_fresh(spec, tasks, design_hash, ready):
        return with_skill(
            decision(
                "spec-tasks",
                "tasks",
                "tasks が無い、または design ハッシュと source_sha256.design_at_tasks が一致しない",
                feature=feature,
                mutations=mutations,
            )
        )
    return gate_followup(repo, spec, feature, mutations)


def light_after_requirements(repo: Repo, spec: dict | None, feature: str, mutations: list, scale: str | None, ack: bool) -> dict:
    if not generated(spec, "design") or not repo.design_path.is_file() or not generated(spec, "tasks") or not has_task(read_text(repo.tasks_path)):
        if generated(spec, "design") and repo.design_path.is_file() and not design_fresh(repo, spec, False):
            return from_design(repo, spec, feature, mutations, design_is_fresh=False, scale=scale, ack=ack)
        return with_skill(
            decision(
                "spec-quick",
                "quick",
                "軽量。設計とタスクを1回で書く",
                feature=feature,
                mutations=mutations,
            )
        )
    return from_design(repo, spec, feature, mutations, design_is_fresh=design_fresh(repo, spec, False), scale=scale, ack=ack)


def step_decision(feature: str, step: dict, mutations: list, speed: str | None) -> dict:
    if step.get("stop") == "split":
        return decision(
            "stop-split-exists",
            "requirements",
            "req-grill.md の Split にある名前が、この spec から分けたものではない既存フォルダと重なる。名前を直してから再開する",
            feature=feature,
            mutations=mutations,
            details={"names": step["names"]},
        )
    if step.get("step") == "split":
        return with_skill(
            decision(
                "split-brief",
                "requirements",
                "grill で別 spec に分けると決めた範囲に brief が無い。分割モードの sdd-new で書く",
                feature=feature,
                mutations=mutations,
                details={"split": step["names"], "source": f"docs/specs/{feature}/req-grill.md"},
            )
        )
    if "stop" in step:
        return decision(
            "stop-grill-blocked",
            "requirements",
            f"{step['file']} が BLOCKED のまま。成果物に答えを書くか、方針を決めてから再開する",
            feature=feature,
            mutations=mutations,
            details={"grill": step["file"]},
        )
    if step["step"] == "generate":
        action, reason = "spec-requirements", "requirements が未生成"
        return with_skill(decision(action, "requirements", reason, feature=feature, mutations=mutations))
    if step["step"] == "grill":
        extra = []
        if step.get("escalate") and speed == "light":
            extra = [
                {"op": "set", "key": "speed", "value": "normal"},
                {"op": "set", "key": "speed_rationale", "value": "軽量のままでは要求が確定しない。速度を通常にする"},
            ]
        details = {}
        reason = "要求の grill が古い、未了、または未決の Open question がある"
        if step.get("boundary_out"):
            details["boundary_out"] = step["boundary_out"]
            reason = "Boundary の out は機能の対象外だけを書く。設計の決定はここに載せない"
        return with_skill(
            decision(
                "grill-req",
                "requirements",
                reason,
                feature=feature,
                mutations=list(mutations) + extra,
                details=details,
            )
        )
    if step["step"] == "fix":
        return with_skill(
            decision(
                "spec-requirements",
                "requirements",
                "機械チェックが失敗した。レビューは始めない",
                feature=feature,
                mutations=mutations,
                details={"checks": step["checks"]},
            )
        )
    return with_skill(
        decision(
            "review-requirements",
            "requirements",
            "requirements レビューが GO + VERIFIED ではない、または Output SHA256 が一致しない",
            feature=feature,
            mutations=mutations,
            details={"checks": step.get("checks") or []},
        )
    )


AUTHORING_ACTIONS = {
    "needs-speed",
    "grill-req",
    "split-brief",
    "spec-requirements",
    "review-requirements",
    "spec-design",
    "review-design",
    "spec-tasks",
    "spec-quick",
}


def apply_upstream(result: dict, repo: Repo, allow: bool) -> dict:
    if allow or result["action"] not in AUTHORING_ACTIONS:
        return result
    blockers = upstream_blockers(repo)
    if not blockers:
        return result
    return decision(
        "stop-upstream",
        "blocked",
        "roadmap の上流 spec が、この checkout ではまだタスク生成まで終わっていない",
        feature=result["feature"],
        mutations=result.get("mutations") or [],
        details={"blocking": blockers},
    )


def effective_speed(spec: dict | None, speed_arg: str | None) -> str | None:
    if speed_arg in {"light", "normal"}:
        return speed_arg
    if spec and spec.get("speed") in {"light", "normal"}:
        return spec["speed"]
    return None


def decide(
    root: Path,
    feature: str,
    *,
    flow: str | None = None,
    speed: str | None = None,
    ack: bool = False,
    force: bool = False,
    allow_incomplete: bool = False,
    allow_upstream: bool = False,
) -> dict:
    repo = Repo(root, feature)
    try:
        spec = load_json(repo.spec_path)
    except (json.JSONDecodeError, ValueError) as exc:
        return decision("stop-invalid-spec", "blocked", f"spec.json を読めない: {exc}", feature=feature)

    brief = read_text(repo.brief_path)
    if flow == "impl":
        return decision(
            "instruct-impl",
            "done",
            "実装は /sdd-impl。オーケストレーションでは実装しない",
            feature=feature,
        )
    if brief is None and spec is None:
        return decision(
            "instruct-discovery",
            "blocked",
            "brief.md も spec.json も無い。先に /sdd-new を実行する",
            feature=feature,
        )

    path = route_path(brief, spec)
    chosen = effective_speed(spec, speed)
    tasks = read_text(repo.tasks_path)
    ready = bool(spec and spec.get("ready_for_implementation") is True)
    explicit_update = flow in {"requirements-update", "design-update"}
    dfresh = design_fresh(repo, spec, ready)
    tfresh = tasks_fresh(spec, tasks, sha256_file(repo.design_path), ready)

    if (
        ready
        and (has_open_task(tasks) or has_blocked(tasks))
        and not allow_incomplete
        and (explicit_update or not (dfresh and tfresh))
    ):
        return decision(
            "stop-modification",
            "blocked",
            "実装が終わっていない spec は変更しない。先に /sdd-impl を完了する",
            feature=feature,
            details={"open_tasks": has_open_task(tasks), "blocked": has_blocked(tasks)},
        )

    if ready and dfresh and tfresh and not explicit_update:
        return decision(
            "instruct-impl",
            "done",
            "要求・設計・タスクは承認済みで最新。実装は /sdd-impl",
            feature=feature,
        )

    mutations: list[dict] = []
    if chosen is not None and (spec is None or spec.get("speed") != chosen):
        mutations.append({"op": "set", "key": "speed", "value": chosen})
    if ready and not (dfresh and tfresh) and not explicit_update:
        mutations.extend(invalidate_ready(spec))
    if explicit_update:
        mutations.extend(invalidate_ready(spec))

    def finish(result: dict) -> dict:
        return apply_upstream(result, repo, allow_upstream)

    if path == "none" and not explicit_update:
        return decision(
            "stop-no-spec",
            "blocked",
            "この依頼は spec を作らない。仕様化には入らない",
            feature=feature,
            mutations=mutations,
        )

    if chosen is None and not explicit_update:
        return finish(
            decision(
                "needs-speed",
                "requirements",
                "速度はまだ選ばれていない。提案を見て --speed light か --speed normal を付ける",
                feature=feature,
                mutations=mutations,
                details={"proposal": proposed_speed(brief, spec)},
            )
        )

    if chosen == "light" and (spec or {}).get("quick_sanity") == "follow_up" and flow != "requirements-update":
        return finish(
            decision(
                "stop-quick-follow-up",
                "quick",
                "quick_sanity が follow_up。自動承認しない",
                feature=feature,
                mutations=mutations,
            )
        )

    if flow == "design-update":
        if force or not dfresh:
            if force and dfresh:
                reason = "設計更新の初回。ハッシュが最新でも設計をやり直す"
            else:
                reason = "設計更新。設計成果物が最新ではない"
            picked = design_action(repo, spec)
            if force and dfresh:
                picked = {"action": "spec-design", "mode": "diff" if repo.design_path.is_file() else "full", "checks": []}
            if picked["action"] == "design-fresh":
                return finish(
                    decision(
                        "phase-terminal",
                        "design",
                        "設計は最新。Phase Handoff を出す",
                        feature=feature,
                        mutations=mutations,
                        details={"template": "phase-handoff"},
                    )
                )
            return finish(emit_design(repo, spec, feature, mutations, picked, reason))
        return finish(
            decision(
                "phase-terminal",
                "design",
                "設計は最新。Phase Handoff を出す",
                feature=feature,
                mutations=mutations,
                details={"template": "phase-handoff"},
            )
        )

    step = requirements_step(repo, spec)
    if step is not None:
        return finish(step_decision(feature, step, mutations, chosen))
    req_hash = sha256_file(repo.requirements_path)
    if flow == "requirements-update":
        extra = [] if accepted_as_is(spec, "requirements", req_hash) else [{"op": "set", "key": "awaiting", "value": "requirements"}]
        return finish(
            decision(
                "phase-terminal",
                "requirements",
                "要求ブロックは完了。Phase Handoff を出す",
                feature=feature,
                mutations=list(mutations) + extra,
                details={"template": "phase-handoff"},
            )
        )
    if not accepted_as_is(spec, "requirements", req_hash):
        if ack and (spec or {}).get("awaiting") == "requirements":
            mutations = list(mutations) + release(spec, "requirements", req_hash)
        else:
            if accepted(spec, "requirements"):
                reason = "承認後に要求が書き換わった。書き換わった要求の確認で止まる。次の /sdd-spec が --ack で先へ進む"
            else:
                reason = "要求の確認で止まる。次の /sdd-spec が --ack で先へ進む"
            return finish(
                decision(
                    "phase-terminal",
                    "requirements",
                    reason,
                    feature=feature,
                    mutations=list(mutations) + [{"op": "set", "key": "awaiting", "value": "requirements"}],
                    details={"template": "phase-handoff"},
                )
            )
    scale = scale_of(brief, spec)
    if chosen == "light":
        result = light_after_requirements(repo, spec, feature, mutations, scale, ack)
    else:
        result = from_design(repo, spec, feature, mutations, design_is_fresh=dfresh, scale=scale, ack=ack)
    return apply_upstream(result, repo, allow_upstream)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="sdd", description="Deterministic SDD orchestrator state")
    sub = parser.add_subparsers(dest="command", required=True)
    nxt = sub.add_parser("next", help="print the next orchestrator action as JSON")
    nxt.add_argument("feature")
    nxt.add_argument("--root", type=Path, default=Path.cwd())
    nxt.add_argument("--flow", choices=("requirements-update", "design-update", "impl"))
    nxt.add_argument("--speed", choices=("light", "normal"))
    nxt.add_argument("--ack", action="store_true")
    nxt.add_argument("--force", action="store_true")
    nxt.add_argument("--allow-incomplete", action="store_true")
    nxt.add_argument("--allow-upstream", action="store_true")
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    if args.command != "next":
        parser.error("unknown command")
    if not FEATURE_RE.fullmatch(args.feature):
        print("feature 名が不正", file=sys.stderr)
        return 2
    result = decide(
        args.root.resolve(),
        args.feature,
        flow=args.flow,
        speed=args.speed,
        ack=args.ack,
        force=args.force,
        allow_incomplete=args.allow_incomplete,
        allow_upstream=args.allow_upstream,
    )
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
