#!/usr/bin/env python3
"""Check one sdd-eval run and compare it with the previous run of the same case.

  python3 scripts/eval_check.py evals/results/<stamp>-<case>

The run directory holds the copied artifacts and score.md:

  case: <case>

  - E1: pass — "<quote copied from the artifact>" (requirements.md)
  - E2: fail — <reason>
  - E9: pass — none found (design.md)        # only for [absence] items

Exit 0 only when every expected item is scored, every quote exists in its file,
the mechanical checks pass, and no item went from pass to fail.
"""

from __future__ import annotations

import importlib.util
import json
import re
import sys
from pathlib import Path

sys.dont_write_bytecode = True

ROOT = Path(__file__).resolve().parents[1]
_spec = importlib.util.spec_from_file_location("sdd", ROOT / ".agents" / "skills" / "sdd-spec" / "scripts" / "sdd.py")
sdd = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(sdd)

EXPECT_RE = re.compile(r"^- (?P<id>E\d+)(?P<absence> \[absence\])?:", re.M)
SCORE_RE = re.compile(r"^- (?P<id>E\d+): (?P<verdict>pass|fail)\b(?P<rest>.*)$", re.M)
EVIDENCE_RE = re.compile(r"\"(?P<quote>.+)\"\s*\((?P<file>[A-Za-z0-9._/-]+)\)")
CASE_RE = re.compile(r"^case:\s*(\S+)", re.M)


def squash(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def read(path: Path) -> str | None:
    return path.read_text(encoding="utf-8") if path.is_file() else None


def parse_scores(text: str) -> dict[str, tuple[str, str]]:
    return {m.group("id"): (m.group("verdict"), m.group("rest")) for m in SCORE_RE.finditer(text)}


def previous_run(run: Path, case: str) -> Path | None:
    older = []
    for other in run.parent.iterdir():
        if other == run or not other.is_dir() or other.name >= run.name:
            continue
        score = read(other / "score.md")
        match = CASE_RE.search(score or "")
        if match and match.group(1) == case:
            older.append(other)
    return max(older, key=lambda p: p.name) if older else None


def mechanical(run: Path) -> list[str]:
    problems = []
    req = read(run / "requirements.md")
    design = read(run / "design.md")
    tasks = read(run / "tasks.md")
    if req is not None:
        problems += [f"requirements: {item}" for item in sdd.mechanical_findings("requirements", req)]
    if design is not None:
        problems += [f"design: {item}" for item in sdd.mechanical_findings("design", design)]
    if tasks is not None:
        try:
            spec = json.loads(read(run / "spec.json") or "{}")
        except json.JSONDecodeError:
            spec = {}
        gate = sdd.task_gate(spec, tasks, sdd.sha256_file(run / "design.md"), design, req)
        problems += [f"tasks: {path} is in no boundary" for path in gate.get("uncovered_files", [])]
        problems += [f"tasks: requirement {rid} is in no req" for rid in gate.get("uncovered_reqs", [])]
    return problems


def check(run: Path, cases_dir: Path) -> tuple[list[str], list[str]]:
    """(report lines, failures). An empty failures list means the run is acceptable."""
    failures: list[str] = []
    score_text = read(run / "score.md")
    if score_text is None:
        return [], ["score.md がない"]
    case_match = CASE_RE.search(score_text)
    if not case_match:
        return [], ["score.md に case: がない"]
    case = case_match.group(1)
    expect_text = read(cases_dir / case / "expect.md")
    if expect_text is None:
        return [], [f"evals/cases/{case}/expect.md がない"]
    expected = {m.group("id"): bool(m.group("absence")) for m in EXPECT_RE.finditer(expect_text)}
    scores = parse_scores(score_text)

    for item, absence in expected.items():
        if item not in scores:
            failures.append(f"{item}: 採点がない")
            continue
        verdict, rest = scores[item]
        if verdict != "pass" or absence:
            continue
        evidence = EVIDENCE_RE.search(rest)
        if not evidence:
            failures.append(f"{item}: pass なのに引用と (ファイル) がない")
            continue
        target = read(run / evidence.group("file"))
        if target is None or squash(evidence.group("quote")) not in squash(target):
            failures.append(f"{item}: 引用が {evidence.group('file')} に見つからない")

    for problem in mechanical(run):
        failures.append(f"機械チェック: {problem}")

    passed = sum(1 for item in expected if scores.get(item, ("fail", ""))[0] == "pass")
    report = [f"case: {case}", f"score: {passed}/{len(expected)}"]

    prior = previous_run(run, case)
    if prior is not None:
        before = parse_scores(read(prior / "score.md") or "")
        before_passed = sum(1 for item in expected if before.get(item, ("fail", ""))[0] == "pass")
        report.append(f"previous: {prior.name} {before_passed}/{len(expected)}")
        for item in expected:
            if before.get(item, ("fail", ""))[0] == "pass" and scores.get(item, ("fail", ""))[0] != "pass":
                failures.append(f"{item}: 前回 pass から fail に下がった")
    else:
        report.append("previous: なし")

    questions = read(run / "questions.md") or ""
    report.append(f"unanswered questions: {len(re.findall(r'unanswered', questions))}")
    return report, failures


def main(argv: list[str] | None = None) -> int:
    args = argv if argv is not None else sys.argv[1:]
    if len(args) != 1:
        print(__doc__, file=sys.stderr)
        return 2
    run = Path(args[0]).resolve()
    report, failures = check(run, ROOT / "evals" / "cases")
    for line in report:
        print(line)
    for line in failures:
        print(f"NG {line}")
    print("RESULT: OK" if not failures else "RESULT: NG")
    return 0 if not failures else 1


if __name__ == "__main__":
    sys.exit(main())
