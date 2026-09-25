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
ISOLATED = {
    "grill-req",
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


def has_task(tasks_text: str | None) -> bool:
    return bool(tasks_text and TASK_RE.search(tasks_text))


def has_open_task(tasks_text: str | None) -> bool:
    return bool(tasks_text and OPEN_TASK_RE.search(tasks_text))


def has_blocked(tasks_text: str | None) -> bool:
    return bool(tasks_text and "_Blocked:" in tasks_text)


def has_open_question(requirements: str | None) -> bool:
    return bool(requirements and "Open question:" in requirements)


def rounds_exhausted(text: str | None) -> bool:
    if not text:
        return False
    ai = re.search(r"^AI round:\s*(\d+)\s*$", text, re.M)
    human = re.search(r"^Human round:\s*(\d+)\s*$", text, re.M)
    return bool(ai and int(ai.group(1)) >= 3 and human and int(human.group(1)) >= 3)


def route_path(brief: str | None) -> str | None:
    if not brief:
        return None
    match = PATH_RE.search(brief)
    return match.group(1) if match else None


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
    return found


def proposed_speed(brief: str | None) -> str | None:
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


def release(spec: dict | None, phase: str) -> list[dict]:
    current = dict((spec or {}).get("accepted") or {})
    current[phase] = True
    return [
        {"op": "set", "key": "accepted", "value": current},
        {"op": "set", "key": "awaiting", "value": None},
    ]


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
        self.req_review_path = self.spec_dir / "reviews" / "requirements-review.md"
        self.design_review_path = self.spec_dir / "reviews" / "design-review.md"
        self.roadmap_path = root / "docs" / "steering" / "roadmap.md"

    def hashes(self) -> dict[str, str | None]:
        return {
            "brief": sha256_file(self.brief_path),
            "requirements": sha256_file(self.requirements_path),
            "design": sha256_file(self.design_path),
        }


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
    )


def tasks_fresh(spec: dict | None, tasks: str | None, design_hash: str | None, ready: bool) -> bool:
    if not generated(spec, "tasks") or not has_task(tasks):
        return False
    recorded = source_hash(spec, "design_at_tasks")
    if recorded is None:
        return ready
    return recorded == design_hash


def task_gate(spec: dict | None, tasks: str | None, design_hash: str | None) -> dict:
    gaps = []
    if not has_task(tasks):
        gaps.append("1")
    if not generated(spec, "tasks"):
        gaps.append("2")
    recorded = source_hash(spec, "design_at_tasks")
    if recorded is None or recorded != design_hash:
        gaps.append("4")
    blocked = has_blocked(tasks)
    if gaps:
        result = "NOT_VERIFIED"
    elif blocked:
        result = "MANUAL_VERIFY_REQUIRED"
    else:
        result = "VERIFIED"
    if blocked and "3" not in gaps:
        gaps.append("3")
    return {"result": result, "gaps": gaps}


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
    rollback_to_grill = findings_rollback_grill(review) and input_hash is not None and input_hash == recorded_g
    if not verdict_ready or changed_outside_validate or rollback_to_grill or has_open_question(req_text):
        capped = rounds_exhausted(req_grill) and not changed_outside_validate and not rollback_to_grill
        if capped or (
            grill_state(req_grill, req_hash) == "blocked"
            and not changed_outside_validate
            and not rollback_to_grill
            and not has_open_question(req_text)
        ):
            return {"stop": "req", "file": "req-grill.md"}
        return {"step": "grill", "escalate": has_open_question(req_text)}
    verified = (
        review is not None
        and first_verdict(review) == "GO"
        and phase_gate_status(review) == "VERIFIED"
        and output_hash == req_hash
    )
    if verified:
        return None
    findings = mechanical_findings("requirements", req_text)
    if findings:
        return {"step": "fix", "checks": findings}
    return {"step": "review", "checks": []}


def design_action(repo: Repo, spec: dict | None) -> dict:
    review = read_text(repo.design_review_path)
    design_text = read_text(repo.design_path)
    req_hash = sha256_file(repo.requirements_path)
    design_hash = sha256_file(repo.design_path)
    if not repo.design_path.is_file() or not generated(spec, "design"):
        return {"action": "spec-design", "mode": "full", "checks": []}
    req_field = labeled_hash(review, "Requirements SHA256")
    design_field = labeled_hash(review, "Design SHA256")
    if review is not None and req_field != req_hash:
        return {"action": "spec-design", "mode": "diff", "checks": []}
    fresh = (
        first_verdict(review) == "GO"
        and phase_gate_status(review) == "VERIFIED"
        and req_field == req_hash
        and design_field == design_hash
        and design_field is not None
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
    gate = task_gate(spec, tasks, design_hash)
    if gate["result"] == "VERIFIED":
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
            "タスクに _Blocked:_ がある。人間の判断が要る",
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
    details = {"mode": picked["mode"], "checks": picked.get("checks") or []}
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
    if scale == "large" and not accepted(spec, "design"):
        if ack and (spec or {}).get("awaiting") == "design":
            mutations = list(mutations) + release(spec, "design")
        else:
            return decision(
                "phase-terminal",
                "design",
                "規模が大きい。設計の確認で止まる。次の /sdd-spec が --ack でタスクへ進む",
                feature=feature,
                mutations=list(mutations) + [{"op": "set", "key": "awaiting", "value": "design"}],
                details={"template": "phase-handoff"},
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
        return with_skill(
            decision(
                "grill-req",
                "requirements",
                "要求の grill が古い、未了、または未決の Open question がある",
                feature=feature,
                mutations=list(mutations) + extra,
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

    path = route_path(brief)
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
                details={"proposal": proposed_speed(brief)},
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
    if flow == "requirements-update":
        return finish(
            decision(
                "phase-terminal",
                "requirements",
                "要求ブロックは完了。Phase Handoff を出す",
                feature=feature,
                mutations=mutations,
                details={"template": "phase-handoff"},
            )
        )
    if not accepted(spec, "requirements"):
        if ack and (spec or {}).get("awaiting") == "requirements":
            mutations = list(mutations) + release(spec, "requirements")
        else:
            return finish(
                decision(
                    "phase-terminal",
                    "requirements",
                    "要求の確認で止まる。次の /sdd-spec が --ack で先へ進む",
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
