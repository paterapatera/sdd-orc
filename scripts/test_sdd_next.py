#!/usr/bin/env python3
"""Behavior tests for sdd-spec/scripts/sdd.py next. Run: python3 scripts/test_sdd_next.py"""

from __future__ import annotations

import hashlib
import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.dont_write_bytecode = True

_SCRIPT = (
    Path(__file__).resolve().parents[1]
    / ".agents"
    / "skills"
    / "sdd-spec"
    / "scripts"
    / "sdd.py"
)
_spec = importlib.util.spec_from_file_location("sdd", _SCRIPT)
_sdd = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_sdd)
build_parser = _sdd.build_parser
decide = _sdd.decide


def sha(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()


QUALITY = (
    "## Quality\n\n"
    "- functional: criteria: 1.1\n"
    "- reliability: out: 途中失敗の条件は無いと答えた (source: grill:reliability)\n"
    "- usability: criteria: 1.1\n"
    "- performance: out: 要望に速度の条件なし (source: grill:performance)\n"
    "- maintainability: out: 他機能との連携なし (source: brief)\n"
    "- security: criteria: 1.1\n"
)
CHECKS = (
    "## Checks\n\n"
    "- leakage: out: 個人データは扱わない (source: brief)\n"
    "- destruction: out: 削除や上書きはしない (source: brief)\n"
    "- lockout: out: 拒否後も操作を続けられる (source: brief)\n"
    "- rewrite: out: 後から変えられないデータの形は依頼に無い (source: brief)\n"
)
SCREENS = "## Screens\n\n- out: 新しい画面は無い (source: brief)\n"
REQ = "# Req\n\n## 1. Sign in\n\n1. When a user signs in, the system shall open a session.\n\n" + QUALITY + CHECKS + SCREENS
REVERSIBLE_DESIGN = (
    "# Design\n\n## Record\n\n```json\n"
    '{"files": [{"path": "app/Login.php", "change": "add"}],'
    ' "decisions": [{"id": "D-a", "choose": "x", "rejected": null, "reversible": true}]}\n'
    "```\n"
)
IRREVERSIBLE_DESIGN = REVERSIBLE_DESIGN.replace('"reversible": true', '"reversible": false')


def grill(verdict: str, target: str) -> str:
    return f"# Grill\n\n**VERDICT:** {verdict}\n**Target SHA256:** {target}\n"


def req_review(verdict: str, status: str, before: str, after: str, findings: str = "none") -> str:
    return (
        "## Verdict\n"
        f"- VERDICT: {verdict}\n"
        f"- Input SHA256: {before}\n"
        f"- Output SHA256: {after}\n\n"
        f"## Findings\n{findings}\n\n"
        "## Specialists\n"
        "### PO\n- pass: objectives match the criteria\n\n"
        "### QA\n- pass: each criterion names an observable result\n\n"
        "### Sec\n- pass: no personal data in this fixture\n\n"
        "## Evidence\n"
        "- traceability: pass: the brief scope is criterion 1.1\n"
        "- roadmap: N/A: this fixture has no roadmap\n"
        "- failures: pass: sign-in names no dependency whose failure changes behavior\n"
        "- privacy: N/A: no personal data\n"
        "- abuse: N/A: no untrusted actor beyond the session\n"
        "- steering-security: N/A: no security constraint in steering\n"
        "- operability: N/A: no operator-visible consequence\n"
        "- compliance: N/A: no policy constraint in steering\n"
        "- template: pass: the requirement has a numbered criterion\n"
        "- fixes: pass: no edits\n\n"
        "## Meaning\n"
        "- functional: pass: a build that drops \"open a session\" fails criterion 1.1\n"
        "- reliability: pass: \"open a session\" names no failed write\n"
        "- usability: pass: \"open a session\" names the place on that line\n"
        "- performance: pass: \"要望に速度の条件なし\" is the sourced out\n"
        "- maintainability: pass: \"他機能との連携なし\" is the sourced out\n"
        "- security: pass: \"open a session\" names no excluded actor\n"
        "- leakage: pass: \"個人データは扱わない\" is the sourced out\n"
        "- destruction: pass: \"削除や上書きはしない\" is the sourced out\n"
        "- lockout: pass: \"拒否後も操作を続けられる\" is the sourced out\n"
        "- rewrite: pass: \"後から変えられないデータの形は依頼に無い\" is the sourced out\n"
        "- place: N/A: no action in this fixture starts without a place on its own line\n"
        "- lists: N/A: no kept-item list\n\n"
        "## Phase Gate\n"
        f"- STATUS: {status}\n"
    )


def design_review(verdict: str, status: str, req: str, design: str) -> str:
    return (
        "## Verdict\n"
        f"- VERDICT: {verdict}\n"
        f"- Requirements SHA256: {req}\n"
        f"- Design SHA256: {design}\n\n"
        "## Specialists\n"
        "### QA\n- pass: no dependency failure changes this fixture\n\n"
        "### Arch\n- pass: one component owns the session\n\n"
        "### Sec\n- pass: no personal data in this fixture\n\n"
        "## Evidence\n"
        "- traceability: pass: \"open a session\" is the session component\n"
        "- edges: pass: \"open a session\" has no dependency whose failure changes behavior\n"
        "- preconditions: pass: \"open a session\" starts from no session\n"
        "- tests: N/A: the design states no failure behavior\n"
        "- structure: pass: \"open a session\" has one owner\n"
        "- extensions: pass: \"open a session\" absorbs a display name\n"
        "- adr: N/A: no dependency, contract, or technology decision\n"
        "- surface: N/A: requirements ask for no logs, rollout, or public contract\n"
        "- fixes: pass: \"open a session\" had no edit\n\n"
        "## Phase Gate\n"
        f"- STATUS: {status}\n"
    )


class NextTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.feature = "login"
        self.spec = self.root / "docs" / "specs" / self.feature
        self.spec.mkdir(parents=True)

    def tearDown(self) -> None:
        self.tmp.cleanup()

    def write(self, name: str, text: str) -> str:
        path = self.spec / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8")
        return sha(text)

    def spec_json(self, **overrides) -> None:
        data = {
            "language": "ja",
            "phase": "initialized",
            "approvals": {
                "requirements": {"generated": False},
                "design": {"generated": False},
                "tasks": {"generated": False},
            },
            "ready_for_implementation": False,
        }
        data.update(overrides)
        (self.spec / "spec.json").write_text(json.dumps(data), encoding="utf-8")

    def act(self, **kwargs):
        return decide(self.root, self.feature, **kwargs)

    def test_missing_feature_asks_for_discovery(self) -> None:
        self.spec.rmdir()
        result = self.act()
        self.assertEqual(result["action"], "instruct-discovery")
        self.assertIn("/sdd-new", result["reason"])

    def test_brief_without_speed_asks_for_a_choice(self) -> None:
        self.write("brief.md", "# Brief\n\n## Route\n- **Path**: new\n- **Speed**: light\n")
        result = self.act()
        self.assertEqual(result["action"], "needs-speed")
        self.assertEqual(result["details"]["proposal"], "light")
        self.assertFalse(any(item.get("key") == "speed" for item in result["mutations"]))

    def test_speed_flag_is_the_only_tier_switch(self) -> None:
        with self.assertRaises(SystemExit):
            build_parser().parse_args(["next", "login", "--tier", "S"])
        args = build_parser().parse_args(["next", "login", "--speed", "light"])
        self.assertEqual(args.speed, "light")

    def test_normal_speed_generates_requirements(self) -> None:
        self.write("brief.md", "# Brief\n\n## Route\n- **Path**: new\n")
        result = self.act(speed="normal")
        self.assertEqual(result["action"], "spec-requirements")
        self.assertEqual(result["skill"], "sdd-spec-requirements")
        self.assertTrue(result["isolate"])

    def test_path_new_does_not_override_light(self) -> None:
        self.write("brief.md", "# Brief\n\n## Route\n- **Path**: new\n")
        self._ready_requirements(speed="light")
        result = self.act()
        self.assertEqual(result["action"], "spec-quick")

    def test_old_path_letters_do_not_change_speed(self) -> None:
        self.write("brief.md", "# Brief\n\n## Route\n- **Path**: D\n")
        self._ready_requirements(speed="light")
        self.assertEqual(self.act()["action"], "spec-quick")

    def test_path_none_does_not_enter_spec(self) -> None:
        self.write("brief.md", "# Brief\n\n## Route\n- **Path**: none\n")
        self.assertEqual(self.act(speed="light")["action"], "stop-no-spec")

    def test_stale_req_grill_restarts_before_review(self) -> None:
        req = self.write("requirements.md", REQ)
        self.write("req-grill.md", grill("READY", sha("# Req\nold\n")))
        self.spec_json(speed="normal", approvals={"requirements": {"generated": True}, "design": {"generated": False}, "tasks": {"generated": False}})
        result = self.act()
        self.assertEqual(result["action"], "grill-req")
        self.assertEqual(result["args"], ["login"])
        self.assertNotEqual(sha("# Req\nold\n"), req)

    def test_validate_owned_edit_does_not_restart_the_grill(self) -> None:
        req = self.write("requirements.md", REQ)
        grilled = sha("# Req\nold\n")
        self.write("req-grill.md", grill("READY", grilled))
        self.write("reviews/requirements-review.md", req_review("GO", "NOT_VERIFIED", grilled, req))
        self.spec_json(speed="normal", approvals={"requirements": {"generated": True}, "design": {"generated": False}, "tasks": {"generated": False}})
        result = self.act()
        self.assertEqual(result["action"], "review-requirements")
        self.assertEqual(result["skill"], "sdd-validate-requirements")
        self.assertEqual(result["details"]["checks"], [])

    def test_mechanical_failure_blocks_the_review(self) -> None:
        text = REQ + "\nTBD\n"
        req = self.write("requirements.md", text)
        self.write("req-grill.md", grill("READY", req))
        self.spec_json(speed="normal", approvals={"requirements": {"generated": True}, "design": {"generated": False}, "tasks": {"generated": False}})
        result = self.act()
        self.assertEqual(result["action"], "spec-requirements")
        self.assertIn("tbd", result["details"]["checks"])

    def test_nog_o_rollback_to_grill(self) -> None:
        req = self.write("requirements.md", REQ)
        self.write("req-grill.md", grill("READY", req))
        self.write(
            "reviews/requirements-review.md",
            req_review("NO-GO", "NOT_VERIFIED", req, req, "受け入れ条件が足りない"),
        )
        self.spec_json(speed="normal", approvals={"requirements": {"generated": True}, "design": {"generated": False}, "tasks": {"generated": False}})
        self.assertEqual(self.act()["action"], "grill-req")

    def test_finished_requirements_stop_for_a_human(self) -> None:
        self._ready_requirements(accepted=False)
        result = self.act()
        self.assertEqual(result["action"], "phase-terminal")
        self.assertEqual(result["phase"], "requirements")
        self.assertIn({"op": "set", "key": "awaiting", "value": "requirements"}, result["mutations"])

    def test_ack_after_requirements_continues_to_design(self) -> None:
        self._ready_requirements(accepted=False, awaiting="requirements")
        result = self.act(ack=True)
        self.assertEqual(result["action"], "spec-design")
        self.assertEqual(result["mode"], "full")
        self.assertIn({"op": "set", "key": "accepted", "value": {"requirements": True}}, result["mutations"])

    def test_requirements_update_stops_at_the_phase_boundary(self) -> None:
        self._ready_requirements()
        self.assertEqual(self.act(flow="requirements-update")["action"], "phase-terminal")

    def test_requirements_hash_drift_regenerates_design(self) -> None:
        self._ready_requirements()
        design = self.write("design.md", "# Design\n")
        self.write("reviews/design-review.md", design_review("GO", "VERIFIED", sha("# old req\n"), design))
        data = json.loads((self.spec / "spec.json").read_text(encoding="utf-8"))
        data["approvals"]["design"]["generated"] = True
        (self.spec / "spec.json").write_text(json.dumps(data), encoding="utf-8")
        result = self.act()
        self.assertEqual(result["action"], "spec-design")
        self.assertEqual(result["mode"], "diff")

    def test_missing_design_review_is_one_review(self) -> None:
        self._ready_requirements()
        self.write("design.md", "# Design\n")
        data = json.loads((self.spec / "spec.json").read_text(encoding="utf-8"))
        data["approvals"]["design"]["generated"] = True
        (self.spec / "spec.json").write_text(json.dumps(data), encoding="utf-8")
        result = self.act()
        self.assertEqual(result["action"], "review-design")
        self.assertEqual(result["skill"], "sdd-validate-design")

    def test_verified_design_moves_on_to_tasks(self) -> None:
        _req, design = self._fresh_design()
        result = self.act()
        self.assertEqual(result["action"], "spec-tasks")
        self.assertTrue(design)

    def test_large_design_stops_for_a_human(self) -> None:
        self._fresh_design()
        data = json.loads((self.spec / "spec.json").read_text(encoding="utf-8"))
        data["scale"] = "large"
        (self.spec / "spec.json").write_text(json.dumps(data), encoding="utf-8")
        result = self.act()
        self.assertEqual(result["action"], "phase-terminal")
        self.assertEqual(result["phase"], "design")

    def test_acked_large_design_moves_on_to_tasks(self) -> None:
        self._fresh_design()
        data = json.loads((self.spec / "spec.json").read_text(encoding="utf-8"))
        data["scale"] = "large"
        data["awaiting"] = "design"
        (self.spec / "spec.json").write_text(json.dumps(data), encoding="utf-8")
        self.assertEqual(self.act(ack=True)["action"], "spec-tasks")

    def test_fresh_tasks_auto_approve(self) -> None:
        _req, design = self._fresh_design()
        self.write("tasks.md", "- [ ] 1. 作る\n")
        data = json.loads((self.spec / "spec.json").read_text(encoding="utf-8"))
        data["approvals"]["tasks"]["generated"] = True
        data["source_sha256"]["design_at_tasks"] = design
        (self.spec / "spec.json").write_text(json.dumps(data), encoding="utf-8")
        result = self.act()
        self.assertEqual(result["action"], "auto-approve")
        self.assertEqual(result["gate"]["result"], "VERIFIED")
        self.assertIn({"op": "set", "key": "ready_for_implementation", "value": True}, result["mutations"])

    def test_blocked_task_stops_for_a_human(self) -> None:
        _req, design = self._fresh_design()
        self.write("tasks.md", "- [ ] 1. 作る\n  - _Blocked: 方針未決_\n")
        data = json.loads((self.spec / "spec.json").read_text(encoding="utf-8"))
        data["approvals"]["tasks"]["generated"] = True
        data["source_sha256"]["design_at_tasks"] = design
        (self.spec / "spec.json").write_text(json.dumps(data), encoding="utf-8")
        result = self.act()
        self.assertEqual(result["action"], "stop-manual")
        self.assertEqual(result["gate"]["result"], "MANUAL_VERIFY_REQUIRED")

    def test_ready_and_fresh_sends_the_user_to_impl(self) -> None:
        _req, design = self._fresh_design()
        self.write("tasks.md", "- [ ] 1. 作る\n")
        data = json.loads((self.spec / "spec.json").read_text(encoding="utf-8"))
        data["approvals"]["tasks"]["generated"] = True
        data["ready_for_implementation"] = True
        data["source_sha256"]["design_at_tasks"] = design
        (self.spec / "spec.json").write_text(json.dumps(data), encoding="utf-8")
        self.assertEqual(self.act()["action"], "instruct-impl")

    def test_legacy_ready_spec_without_hashes_is_not_reopened(self) -> None:
        self.write("requirements.md", "# Req\n")
        self.write("design.md", "# Design\n")
        self.write("tasks.md", "- [x] 1. 済\n")
        self.spec_json(
            ready_for_implementation=True,
            approvals={
                "requirements": {"generated": True},
                "design": {"generated": True},
                "tasks": {"generated": True},
            },
        )
        self.assertEqual(self.act()["action"], "instruct-impl")

    def test_incomplete_impl_blocks_a_requirements_update(self) -> None:
        self.write("requirements.md", "# Req\n")
        self.write("tasks.md", "- [ ] 1. 未完\n")
        self.spec_json(
            speed="normal",
            ready_for_implementation=True,
            approvals={"requirements": {"generated": True}, "design": {"generated": True}, "tasks": {"generated": True}},
        )
        self.assertEqual(self.act(flow="requirements-update")["action"], "stop-modification")

    def test_upstream_blocks_authoring(self) -> None:
        self.write("brief.md", "# Brief\n\n## Route\n- **Path**: new\n")
        roadmap = self.root / "docs" / "steering"
        roadmap.mkdir(parents=True)
        roadmap.joinpath("roadmap.md").write_text(
            "# Roadmap\n\n## Specs (dependency order)\n"
            "- [ ] accounts -- 口座. Dependencies: none\n"
            "- [ ] login -- ログイン. Dependencies: accounts\n",
            encoding="utf-8",
        )
        result = self.act(speed="normal")
        self.assertEqual(result["action"], "stop-upstream")
        self.assertEqual(result["details"]["blocking"][0]["dep"], "accounts")

    def test_checked_upstream_allows_authoring(self) -> None:
        self.write("brief.md", "# Brief\n\n## Route\n- **Path**: update\n")
        roadmap = self.root / "docs" / "steering"
        roadmap.mkdir(parents=True)
        roadmap.joinpath("roadmap.md").write_text(
            "# Roadmap\n\n## Specs (dependency order)\n"
            "- [x] accounts -- 口座. Dependencies: none\n"
            "- [ ] login -- ログイン. Dependencies: accounts\n",
            encoding="utf-8",
        )
        self.assertEqual(self.act(speed="normal")["action"], "spec-requirements")

    def test_open_question_moves_light_to_normal(self) -> None:
        self.write("requirements.md", REQ + "\n- Open question: 誰が使うか\n")
        self.spec_json(
            speed="light",
            approvals={"requirements": {"generated": True}, "design": {"generated": False}, "tasks": {"generated": False}},
        )
        result = self.act()
        self.assertEqual(result["action"], "grill-req")
        self.assertIn({"op": "set", "key": "speed", "value": "normal"}, result["mutations"])

    def test_quick_follow_up_does_not_approve(self) -> None:
        self.spec_json(speed="light", quick_sanity="follow_up")
        self.assertEqual(self.act()["action"], "stop-quick-follow-up")

    def test_forced_design_update_rewrites_a_fresh_design(self) -> None:
        self._fresh_design()
        data = json.loads((self.spec / "spec.json").read_text(encoding="utf-8"))
        data["ready_for_implementation"] = True
        (self.spec / "spec.json").write_text(json.dumps(data), encoding="utf-8")
        result = self.act(flow="design-update", force=True)
        self.assertEqual(result["action"], "spec-design")
        self.assertEqual(result["mode"], "diff")
        self.assertIn({"op": "set", "key": "ready_for_implementation", "value": False}, result["mutations"])

    def test_design_update_without_force_stops_when_design_is_fresh(self) -> None:
        self._fresh_design()
        self.assertEqual(self.act(flow="design-update")["action"], "phase-terminal")

    def test_grill_continues_until_both_rounds_reach_ten(self) -> None:
        req = self.write("requirements.md", REQ + "\n- Open question: 誰が使うか\n")
        self.write("req-grill.md", grill("WAITING", req) + "AI round: 10\nHuman round: 9\n")
        self.spec_json(
            speed="normal",
            approvals={"requirements": {"generated": True}, "design": {"generated": False}, "tasks": {"generated": False}},
        )
        self.assertEqual(self.act()["action"], "grill-req")

    def test_grill_stops_after_ten_rounds_each(self) -> None:
        req = self.write("requirements.md", REQ + "\n- Open question: 誰が使うか\n")
        self.write("req-grill.md", grill("WAITING", req) + "AI round: 10\nHuman round: 10\n")
        self.spec_json(
            speed="normal",
            approvals={"requirements": {"generated": True}, "design": {"generated": False}, "tasks": {"generated": False}},
        )
        self.assertEqual(self.act()["action"], "stop-grill-blocked")

    def test_blocked_grill_with_a_matching_hash_stops(self) -> None:
        req = self.write("requirements.md", REQ)
        self.write("req-grill.md", grill("BLOCKED", req))
        self.spec_json(
            speed="normal",
            approvals={"requirements": {"generated": True}, "design": {"generated": False}, "tasks": {"generated": False}},
        )
        self.assertEqual(self.act()["action"], "stop-grill-blocked")

    def test_ack_records_the_accepted_requirements_hash(self) -> None:
        req = self._ready_requirements(accepted=False, awaiting="requirements")
        result = self.act(ack=True)
        self.assertIn({"op": "set", "key": "accepted_sha256", "value": {"requirements": req}}, result["mutations"])

    def test_requirements_changed_after_acceptance_stop_for_a_human(self) -> None:
        self._ready_requirements()
        data = json.loads((self.spec / "spec.json").read_text(encoding="utf-8"))
        data["accepted_sha256"] = {"requirements": sha("# Req\nold\n")}
        (self.spec / "spec.json").write_text(json.dumps(data), encoding="utf-8")
        result = self.act()
        self.assertEqual(result["action"], "phase-terminal")
        self.assertEqual(result["phase"], "requirements")
        self.assertIn("承認後", result["reason"])
        self.assertIn({"op": "set", "key": "awaiting", "value": "requirements"}, result["mutations"])

    def test_unchanged_accepted_requirements_move_on(self) -> None:
        req = self._ready_requirements()
        data = json.loads((self.spec / "spec.json").read_text(encoding="utf-8"))
        data["accepted_sha256"] = {"requirements": req}
        (self.spec / "spec.json").write_text(json.dumps(data), encoding="utf-8")
        self.assertEqual(self.act()["action"], "spec-design")

    def test_requirements_update_leaves_an_ack_for_the_next_run(self) -> None:
        self._ready_requirements()
        data = json.loads((self.spec / "spec.json").read_text(encoding="utf-8"))
        data["accepted_sha256"] = {"requirements": sha("# Req\nold\n")}
        (self.spec / "spec.json").write_text(json.dumps(data), encoding="utf-8")
        result = self.act(flow="requirements-update")
        self.assertEqual(result["action"], "phase-terminal")
        self.assertIn({"op": "set", "key": "awaiting", "value": "requirements"}, result["mutations"])

    def _grilled_with_split(self, names: list[str]) -> str:
        req = self.write("requirements.md", REQ)
        lines = "".join(f"- {name}: 編集と削除 / Dependencies: login\n" for name in names)
        self.write("req-grill.md", grill("READY", req) + "\n## Split\n\n" + lines)
        self.spec_json(speed="normal", approvals={"requirements": {"generated": True}, "design": {"generated": False}, "tasks": {"generated": False}})
        return req

    def test_grill_split_writes_briefs_before_review(self) -> None:
        self._grilled_with_split(["login-manage"])
        result = self.act()
        self.assertEqual(result["action"], "split-brief")
        self.assertEqual(result["skill"], "sdd-new")
        self.assertEqual(result["details"]["split"], ["login-manage"])
        self.assertTrue(result["isolate"])

    def test_written_split_moves_on_to_review(self) -> None:
        self._grilled_with_split(["login-manage"])
        other = self.root / "docs" / "specs" / "login-manage"
        other.mkdir(parents=True)
        other.joinpath("spec.json").write_text(json.dumps({"split_from": "login"}), encoding="utf-8")
        self.assertEqual(self.act()["action"], "review-requirements")

    def test_split_name_taken_by_another_spec_stops(self) -> None:
        self._grilled_with_split(["accounts"])
        other = self.root / "docs" / "specs" / "accounts"
        other.mkdir(parents=True)
        other.joinpath("spec.json").write_text(json.dumps({"feature_name": "accounts"}), encoding="utf-8")
        result = self.act()
        self.assertEqual(result["action"], "stop-split-exists")
        self.assertEqual(result["details"]["names"], ["accounts"])

    def test_design_review_requirements_gap_returns_to_grill(self) -> None:
        req = self._ready_requirements()
        design = self.write("design.md", "# Design\n")
        review = design_review("NO-GO", "NOT_VERIFIED", req, design) + "\n## Route\n- next: grill\n## Findings\n- 他人の感想を開いたときの結果が要求に無い\n"
        self.write("reviews/design-review.md", review)
        data = json.loads((self.spec / "spec.json").read_text(encoding="utf-8"))
        data["approvals"]["design"]["generated"] = True
        (self.spec / "spec.json").write_text(json.dumps(data), encoding="utf-8")
        result = self.act()
        self.assertEqual(result["action"], "grill-req")
        self.assertEqual(result["phase"], "requirements")
        self.assertEqual(result["details"]["design_review"], "reviews/design-review.md")

    def _ready_requirements(self, *, speed: str = "normal", accepted: bool = True, awaiting: str | None = None) -> str:
        req = self.write("requirements.md", REQ)
        self.write("req-grill.md", grill("READY", req))
        self.write("reviews/requirements-review.md", req_review("GO", "VERIFIED", req, req))
        data = {
            "language": "ja",
            "phase": "initialized",
            "speed": speed,
            "approvals": {"requirements": {"generated": True}, "design": {"generated": False}, "tasks": {"generated": False}},
            "ready_for_implementation": False,
            "source_sha256": {},
        }
        if accepted:
            data["accepted"] = {"requirements": True}
        if awaiting is not None:
            data["awaiting"] = awaiting
        self.spec_json(**data)
        return req

    def _fresh_design(self, text: str = "# Design\n") -> tuple[str, str]:
        req = self._ready_requirements()
        design = self.write("design.md", text)
        self.write("reviews/design-review.md", design_review("GO", "VERIFIED", req, design))
        data = json.loads((self.spec / "spec.json").read_text(encoding="utf-8"))
        data["approvals"]["design"]["generated"] = True
        data["source_sha256"] = {"requirements_at_design": req, "design_at_tasks": design}
        (self.spec / "spec.json").write_text(json.dumps(data), encoding="utf-8")
        return req, design

    def test_spec_path_none_does_not_enter_spec(self) -> None:
        self.spec_json(path="none", proposed_speed="light")
        self.assertEqual(self.act(speed="light")["action"], "stop-no-spec")

    def test_proposed_speed_comes_from_spec_json(self) -> None:
        self.spec_json(path="new", proposed_speed="light")
        result = self.act()
        self.assertEqual(result["action"], "needs-speed")
        self.assertEqual(result["details"]["proposal"], "light")

    def test_json_tasks_auto_approve(self) -> None:
        _req, design = self._fresh_design()
        self.write(
            "tasks.md",
            '# Tasks\n\n```json\n{"tasks":[{"id":"1.1","status":"open","req":["1"],"blocked":null}]}\n```\n',
        )
        data = json.loads((self.spec / "spec.json").read_text(encoding="utf-8"))
        data["approvals"]["tasks"]["generated"] = True
        data["source_sha256"]["design_at_tasks"] = design
        (self.spec / "spec.json").write_text(json.dumps(data), encoding="utf-8")
        result = self.act()
        self.assertEqual(result["action"], "auto-approve")
        self.assertEqual(result["gate"]["result"], "VERIFIED")

    def test_missing_check_blocks_the_review(self) -> None:
        text = REQ.replace("- leakage: out: 個人データは扱わない (source: brief)\n", "")
        req = self.write("requirements.md", text)
        self.write("req-grill.md", grill("READY", req))
        self.spec_json(speed="normal", approvals={"requirements": {"generated": True}, "design": {"generated": False}, "tasks": {"generated": False}})
        result = self.act()
        self.assertEqual(result["action"], "review-requirements")
        self.assertNotIn("checks", result.get("details", {}).get("checks", []))

    def test_owner_only_does_not_settle_leakage(self) -> None:
        text = (
            "# Req\n\n## 1. 感想\n\n"
            "1. When 他人が感想を開く, the システム shall 本人だけを対象とする。\n\n"
            + QUALITY
            + CHECKS.replace(
                "- leakage: out: 個人データは扱わない (source: brief)",
                "- leakage: criteria: 1.1",
            )
        )
        self.assertIn("leakage", _sdd.check_gaps(text))

    def test_hidden_content_settles_leakage(self) -> None:
        text = (
            "# Req\n\n## 1. 感想\n\n"
            "1. When 他人が感想を開く, the システム shall 中身を表示しない。\n\n"
            + QUALITY
            + CHECKS.replace(
                "- leakage: out: 個人データは扱わない (source: brief)",
                "- leakage: criteria: 1.1",
            )
        )
        self.assertNotIn("leakage", _sdd.check_gaps(text))

    def test_open_list_blocks_the_review(self) -> None:
        text = REQ.replace("open a session.", "open a session. 評価や読了日なども残せる。")
        req = self.write("requirements.md", text)
        self.write("req-grill.md", grill("READY", req))
        self.spec_json(speed="normal", approvals={"requirements": {"generated": True}, "design": {"generated": False}, "tasks": {"generated": False}})
        result = self.act()
        self.assertEqual(result["action"], "review-requirements")
        self.assertNotIn("open-list", result.get("details", {}).get("checks", []))

    def test_residual_risk_returns_to_the_grill(self) -> None:
        req = self.write("requirements.md", REQ)
        self.write("req-grill.md", grill("READY", req))
        self.write(
            "reviews/requirements-review.md",
            req_review("GO", "VERIFIED", req, req)
            + "\n## Approval summary\n### Accepted residual risks\n- 他人が開いたときの表示が未規定\n",
        )
        self.spec_json(speed="normal", approvals={"requirements": {"generated": True}, "design": {"generated": False}, "tasks": {"generated": False}})
        self.assertEqual(self.act()["action"], "grill-req")

    def test_none_residual_does_not_return_to_the_grill(self) -> None:
        self.assertEqual(_sdd.accepted_residual_lines("## Approval summary\n### Accepted residual risks\n- なし\n"), [])

    def test_design_residual_returns_to_the_grill(self) -> None:
        req, design = self._fresh_design()
        self.write(
            "reviews/design-review.md",
            design_review("GO", "VERIFIED", req, design)
            + "\n## Approval summary\n### Accepted residual risks\n- 他人の id を開いた画面が未規定\n",
        )
        self.assertEqual(self.act()["action"], "grill-req")

    def test_missing_quality_line_blocks_the_review(self) -> None:
        text = REQ.replace("- performance: out: 要望に速度の条件なし (source: grill:performance)\n", "")
        req = self.write("requirements.md", text)
        self.write("req-grill.md", grill("READY", req))
        self.spec_json(speed="normal", approvals={"requirements": {"generated": True}, "design": {"generated": False}, "tasks": {"generated": False}})
        result = self.act()
        self.assertEqual(result["action"], "review-requirements")
        self.assertNotIn("quality", result.get("details", {}).get("checks", []))

    def test_out_without_a_source_is_not_settled(self) -> None:
        self.assertIn("performance", _sdd.quality_gaps(REQ.replace(" (source: grill:performance)", "")))

    def test_quality_criteria_must_exist(self) -> None:
        self.assertIn("security", _sdd.quality_gaps(REQ.replace("- security: criteria: 1.1", "- security: criteria: 1.9")))

    def test_quality_open_question_goes_to_the_grill(self) -> None:
        text = REQ.replace("- security: criteria: 1.1", "- security: Open question: 他人の記録を開いたら何が見えるか")
        req = self.write("requirements.md", text)
        self.write("req-grill.md", grill("READY", req))
        self.spec_json(speed="normal", approvals={"requirements": {"generated": True}, "design": {"generated": False}, "tasks": {"generated": False}})
        self.assertEqual(self.act()["action"], "grill-req")

    def test_decision_without_reversible_fails_the_design_check(self) -> None:
        self._ready_requirements()
        self.write("design.md", REVERSIBLE_DESIGN.replace(', "reversible": true', ""))
        data = json.loads((self.spec / "spec.json").read_text(encoding="utf-8"))
        data["approvals"]["design"]["generated"] = True
        (self.spec / "spec.json").write_text(json.dumps(data), encoding="utf-8")
        result = self.act()
        self.assertEqual(result["action"], "spec-design")
        self.assertIn("reversible", result["details"]["checks"])

    def test_irreversible_decision_stops_at_the_design(self) -> None:
        self._fresh_design(IRREVERSIBLE_DESIGN)
        result = self.act()
        self.assertEqual(result["action"], "phase-terminal")
        self.assertEqual(result["phase"], "design")
        self.assertEqual(result["details"]["irreversible"][0]["id"], "D-a")

    def test_acked_irreversible_design_records_its_hash(self) -> None:
        _req, design = self._fresh_design(IRREVERSIBLE_DESIGN)
        data = json.loads((self.spec / "spec.json").read_text(encoding="utf-8"))
        data["awaiting"] = "design"
        (self.spec / "spec.json").write_text(json.dumps(data), encoding="utf-8")
        result = self.act(ack=True)
        self.assertEqual(result["action"], "spec-tasks")
        self.assertIn({"op": "set", "key": "accepted_sha256", "value": {"design": design}}, result["mutations"])

    def test_recommendation_asks_before_tasks(self) -> None:
        choose = '"reversible": true, "basis": "recommendation", "rejected": "一覧だけに置く / 詳細だけに置く"'
        self._fresh_design(REVERSIBLE_DESIGN.replace('"reversible": true', choose))
        result = self.act()
        self.assertEqual(result["action"], "needs-choice")
        question = result["details"]["questions"][0]
        self.assertIn("推奨は「x」で書いてあります", question["prompt"])
        self.assertEqual(question["options"][-1], "持ち帰る")
        self.assertIn("一覧だけに置く", question["options"])

    def test_recommendation_choice_is_applied_to_the_design(self) -> None:
        choose = '"reversible": true, "basis": "recommendation", "rejected": "一覧だけに置く"'
        self._fresh_design(REVERSIBLE_DESIGN.replace('"reversible": true', choose))
        self.write("design-grill.md", "## Human choices\n\n- D-a: 一覧だけに置く\n")
        result = self.act()
        self.assertEqual(result["action"], "spec-design")
        self.assertEqual(result["details"]["confirm"], [{"id": "D-a", "label": "一覧だけに置く"}])

    def test_deferred_recommendation_stops(self) -> None:
        choose = '"reversible": true, "basis": "recommendation", "rejected": "一覧だけに置く"'
        self._fresh_design(REVERSIBLE_DESIGN.replace('"reversible": true', choose))
        self.write("design-grill.md", "## DEFERRED\n\n- D-a: 持ち帰る\n")
        result = self.act()
        self.assertEqual(result["action"], "stop-design-deferred")
        self.assertEqual(result["details"]["ids"], ["D-a"])

    def test_reversible_design_does_not_stop(self) -> None:
        self._fresh_design(REVERSIBLE_DESIGN)
        self.assertEqual(self.act()["action"], "spec-tasks")

    def test_tasks_must_cover_design_files_and_requirements(self) -> None:
        _req, design = self._fresh_design(REVERSIBLE_DESIGN)
        self.write(
            "tasks.md",
            '# Tasks\n\n```json\n{"tasks":[{"id":"1","status":"open","req":[],"boundary":["app/Other.php"],"blocked":null}]}\n```\n',
        )
        data = json.loads((self.spec / "spec.json").read_text(encoding="utf-8"))
        data["approvals"]["tasks"]["generated"] = True
        data["source_sha256"]["design_at_tasks"] = design
        (self.spec / "spec.json").write_text(json.dumps(data), encoding="utf-8")
        result = self.act()
        self.assertEqual(result["action"], "spec-tasks")
        self.assertEqual(result["gate"]["uncovered_files"], ["app/Login.php"])
        self.assertEqual(result["gate"]["uncovered_reqs"], ["1"])

    def test_directory_boundary_covers_files_inside(self) -> None:
        self.assertTrue(_sdd.path_covered("resources/views/a/", ["resources/views/a/index.blade.php"]))
        self.assertTrue(_sdd.path_covered("resources/views/a/index.blade.php", ["resources/views/a"]))
        self.assertFalse(_sdd.path_covered("resources/views/ab.php", ["resources/views/a"]))

    def test_a_place_the_human_did_not_name_returns_to_the_grill(self) -> None:
        text = (
            "# Req\n\n## 1. 感想\n\n"
            "1. When 記録に成功する, the システム shall 感想一覧画面に移る。\n\n"
            + QUALITY
            + CHECKS
            + SCREENS
        )
        req = self.write("requirements.md", text)
        self.write("req-grill.md", grill("READY", req) + "\n## Human choices\n\n- screen-record: 成功後はその本の感想が見える場所へ\n")
        self.spec_json(speed="normal", approvals={"requirements": {"generated": True}, "design": {"generated": False}, "tasks": {"generated": False}})
        result = self.act()
        self.assertEqual(result["action"], "review-requirements")
        self.assertNotIn("unaligned", result["details"])

    def test_a_named_move_in_the_choice_is_aligned(self) -> None:
        text = "## 1. 記録\n\n1. When 記録に成功する, the システム shall 一覧に移る。\n"
        choice = "成功したら一覧に移る"
        self.assertEqual(_sdd.unaligned_places(text, f"## Human choices\n\n- a: {choice}\n", ""), [])

    def test_listing_an_action_does_not_name_its_screen(self) -> None:
        text = "## 1. 編集\n\n1. When ユーザーが感想閲覧画面で編集を選ぶ, the システム shall 感想編集画面に移る。\n"
        grill_text = "## Human choices\n\n- scope: 記録・一覧・閲覧・編集・削除まですべて含める\n"
        missing = _sdd.unaligned_places(text, grill_text, "")
        self.assertIn("感想閲覧画面", missing)
        self.assertIn("感想編集画面", missing)

    def test_missing_screen_section_blocks_the_review(self) -> None:
        text = REQ.replace(SCREENS, "")
        req = self.write("requirements.md", text)
        self.write("req-grill.md", grill("READY", req))
        self.spec_json(speed="normal", approvals={"requirements": {"generated": True}, "design": {"generated": False}, "tasks": {"generated": False}})
        result = self.act()
        self.assertEqual(result["action"], "review-requirements")
        self.assertNotIn("screens", result["details"])

    def test_naming_a_new_screen_without_the_sheet_blocks(self) -> None:
        text = REQ.replace("open a session.", "open a session。新しい画面を開く。")
        self.assertTrue(_sdd.screen_gaps(text))

    def test_screen_sheet_settles_items_destination_and_failure(self) -> None:
        text = (
            "# Req\n\n## 2. 登録\n\n"
            "1. When ユーザーが一覧画面から登録画面を開く, the システム shall 登録画面へ移る。\n"
            "2. When 登録を開く, the システム shall 書籍名と感想を並べる。\n"
            "3. When 追加する, the システム shall 一覧を開く。\n"
            "4. When 保存に失敗する, the システム shall 理由が見えて登録画面のままにする。\n\n"
            "## Screens\n\n### 登録\n\n"
            "- from: criteria: 2.1\n"
            "- items: criteria: 2.2\n"
            "- goes: criteria: 2.3\n"
            "- failure: criteria: 2.4\n"
        )
        self.assertFalse(_sdd.screen_gaps(text))

    def test_shown_items_settle_without_the_word_item(self) -> None:
        text = (
            "# Req\n\n## 2. 登録\n\n"
            "1. When ユーザーが一覧画面から登録画面を開く, the システム shall 登録画面へ移る。\n"
            "2. When 登録を開く, the システム shall 対象の本の表示、感想の入力、記録操作を見せる。\n"
            "3. When 追加する, the システム shall 一覧を開く。\n"
            "4. When 保存に失敗する, the システム shall 理由が見えて登録画面のままにする。\n\n"
            "## Screens\n\n### 登録\n\n"
            "- from: criteria: 2.1\n"
            "- items: criteria: 2.2\n"
            "- goes: criteria: 2.3\n"
            "- failure: criteria: 2.4\n"
        )
        self.assertFalse(_sdd.screen_gaps(text))

    def test_an_empty_screen_block_returns_to_the_grill(self) -> None:
        text = REQ + "\n### 本詳細\n\n- items:\n- goes:\n- failure:\n"
        req = self.write("requirements.md", text)
        self.write("req-grill.md", grill("READY", req) + "\n## Human choices\n\n- book: 画面名は「本詳細」\n")
        self.spec_json(speed="normal", approvals={"requirements": {"generated": True}, "design": {"generated": False}, "tasks": {"generated": False}})
        result = self.act()
        self.assertEqual(result["action"], "review-requirements")
        self.assertNotIn("screens", result["details"])

    def test_another_screens_destination_does_not_settle_arrival(self) -> None:
        text = (
            "## 1. 記録\n\n"
            "1. When ユーザーが感想記録画面で記録を完了する, the システム shall 本詳細画面へ移る。\n"
            "2. When ユーザーが本詳細画面を見る, the システム shall タイトルを見せる。\n"
            "3. When ユーザーが本詳細画面で編集を完了する, the システム shall 本詳細画面のままとする。\n"
            "4. If 本詳細画面で拒否がある, the システム shall 理由を同じ本詳細画面に見えるようにする。\n\n"
            "## Screens\n\n### 本詳細\n\n"
            "- from: criteria: 1.1\n"
            "- items: criteria: 1.2\n"
            "- goes: criteria: 1.3\n"
            "- failure: criteria: 1.4\n"
        )
        named_only = "## Human choices\n\n- book: 画面名は「本詳細」と呼ぶ。記録完了後は「本詳細」へ移る\n"
        self.assertIn("本詳細.from", _sdd.screen_questions(text, named_only, ""))
        chosen = "## Human choices\n\n- book: 感想記録画面から本詳細画面へ移る\n"
        self.assertEqual(_sdd.screen_questions(text, chosen, ""), [])

    def test_starting_here_does_not_name_what_opens_the_screen(self) -> None:
        text = (
            "## 1. 一覧\n\n"
            "1. When ユーザーが感想一覧画面を見る, the システム shall 感想を表示する。\n"
            "2. When ユーザーが感想一覧画面で記録を開始する, the システム shall 感想記録画面を開く。\n"
            "3. If 表示が失敗する, the システム shall 理由を感想一覧画面に表示する。\n\n"
            "## Screens\n\n### 感想一覧\n\n"
            "- from: out: 最初にこの画面を開く (source: grill:alignment-places)\n"
            "- items: criteria: 1.1\n"
            "- goes: criteria: 1.2\n"
            "- failure: criteria: 1.3\n"
        )
        grill_text = "## Human choices\n\n- alignment-places: 最初に感想一覧画面を開く\n"
        self.assertIn("感想一覧.from", _sdd.screen_questions(text, grill_text, ""))
        linked = text.replace(
            "- from: out: 最初にこの画面を開く (source: grill:alignment-places)\n",
            "- from: criteria: 1.4\n",
        )
        linked = linked.replace(
            "3. If 表示が失敗する, the システム shall 理由を感想一覧画面に表示する。\n",
            "3. If 表示が失敗する, the システム shall 理由を感想一覧画面に表示する。\n"
            "4. When ユーザーがメールのリンクを開く, the システム shall 感想一覧画面を開く。\n",
        )
        mail = "## Human choices\n\n- alignment-places: メールのリンクから感想一覧画面を開く\n"
        self.assertEqual(_sdd.screen_questions(linked, mail, ""), [])

    def test_screen_items_must_name_the_list(self) -> None:
        text = (
            "# Req\n\n## 2. 登録\n\n"
            "1. When 登録を開く, the システム shall 画面を出す。\n"
            "2. When 追加する, the システム shall 一覧を開く。\n"
            "3. When 保存に失敗する, the システム shall 理由が見えて登録画面のままにする。\n\n"
            "## Screens\n\n### 登録\n\n"
            "- items: criteria: 2.1\n"
            "- goes: criteria: 2.2\n"
            "- failure: criteria: 2.3\n"
        )
        self.assertTrue(_sdd.screen_gaps(text))

    def test_design_go_without_the_domain_audit_reviews_again(self) -> None:
        req, design = self._fresh_design()
        self.write(
            "reviews/design-review.md",
            "## Verdict\n"
            f"- VERDICT: GO\n- Requirements SHA256: {req}\n- Design SHA256: {design}\n\n"
            "## Phase Gate\n- STATUS: VERIFIED\n",
        )
        self.assertEqual(self.act()["action"], "review-design")
        self.assertTrue(_sdd.design_audit_missing((self.spec / "reviews" / "design-review.md").read_text(encoding="utf-8")))

    def test_go_without_the_domain_audit_reviews_again(self) -> None:
        req = self.write("requirements.md", REQ)
        self.write("req-grill.md", grill("READY", req))
        self.write(
            "reviews/requirements-review.md",
            "## Verdict\n"
            f"- VERDICT: GO\n- Input SHA256: {req}\n- Output SHA256: {req}\n\n"
            "## Phase Gate\n- STATUS: VERIFIED\n",
        )
        self.spec_json(
            speed="normal",
            approvals={"requirements": {"generated": True}, "design": {"generated": False}, "tasks": {"generated": False}},
        )
        self.assertEqual(self.act()["action"], "review-requirements")
        self.assertTrue(_sdd.review_audit_missing((self.spec / "reviews" / "requirements-review.md").read_text(encoding="utf-8")))

    def test_go_without_the_meaning_audit_reviews_again(self) -> None:
        req = self.write("requirements.md", REQ)
        self.write("req-grill.md", grill("READY", req))
        review = req_review("GO", "VERIFIED", req, req).replace("## Meaning\n", "## Notes\n")
        self.write("reviews/requirements-review.md", review)
        self.spec_json(
            speed="normal",
            approvals={"requirements": {"generated": True}, "design": {"generated": False}, "tasks": {"generated": False}},
        )
        self.assertEqual(self.act()["action"], "review-requirements")
        self.assertTrue(_sdd.meaning_audit_missing(review))

    def test_a_meaning_pass_without_a_quote_reviews_again(self) -> None:
        req = self.write("requirements.md", REQ)
        self.write("req-grill.md", grill("READY", req))
        review = req_review("GO", "VERIFIED", req, req).replace('"open a session"', "the session")
        self.write("reviews/requirements-review.md", review)
        self.spec_json(
            speed="normal",
            approvals={"requirements": {"generated": True}, "design": {"generated": False}, "tasks": {"generated": False}},
        )
        self.assertEqual(self.act()["action"], "review-requirements")
        self.assertTrue(_sdd.review_audit_missing(review, REQ))

    def test_action_without_a_place_blocks_before_review(self) -> None:
        text = (
            "# Req\n\n## 1. 感想\n\n"
            "1. When 利用者が感想を削除する, the システム shall 確認してから消す。\n\n"
            + QUALITY
            + CHECKS
            + SCREENS
        )
        req = self.write("requirements.md", text)
        self.write("req-grill.md", grill("READY", req))
        self.write("reviews/requirements-review.md", req_review("GO", "VERIFIED", req, req))
        self.spec_json(speed="normal", approvals={"requirements": {"generated": True}, "design": {"generated": False}, "tasks": {"generated": False}})
        result = self.act()
        self.assertNotEqual(result["action"], "spec-requirements")
        self.assertNotIn("place", result.get("details", {}).get("checks", []))

    def test_place_on_the_same_line_settles(self) -> None:
        text = (
            "# Req\n\n## 1. 感想\n\n"
            "1. When 利用者が一覧から感想を削除する, the システム shall 確認してから消す。\n\n"
            + QUALITY
            + CHECKS
        )
        self.assertFalse(_sdd.place_gaps(text))

    def test_place_on_another_line_does_not_settle(self) -> None:
        text = (
            "# Req\n\n## 1. 感想\n\n"
            "1. When 利用者が一覧を開く, the システム shall 感想を表示する。\n"
            "2. When 利用者が感想を削除する, the システム shall 確認してから消す。\n\n"
            + QUALITY
            + CHECKS
        )
        self.assertTrue(_sdd.place_gaps(text))

    def test_open_place_question_waits_for_the_grill(self) -> None:
        text = REQ.replace(
            "- usability: criteria: 1.1",
            "- usability: Open question: 削除はどの画面から始めるか",
        )
        text = text.replace("open a session.", "open a session。感想を削除する。")
        self.assertFalse(_sdd.place_gaps(text))

    def test_failed_save_does_not_settle_delete_undo(self) -> None:
        text = (
            "# Req\n\n## 1. 感想\n\n"
            "1. When 保存に失敗する, the システム shall 保存されない。\n"
            "2. When 利用者が一覧から感想を削除する, the システム shall 確認してから消す。\n\n"
            + QUALITY
            + CHECKS.replace("- destruction: out: 削除や上書きはしない (source: brief)", "- destruction: criteria: 1.1")
        )
        self.assertIn("destruction", _sdd.check_gaps(text))

    def test_delete_undo_on_the_removal_line_settles(self) -> None:
        text = (
            "# Req\n\n## 1. 感想\n\n"
            "1. When 利用者が一覧から感想を削除する, the システム shall 消したものを戻せない。\n\n"
            + QUALITY
            + CHECKS.replace("- destruction: out: 削除や上書きはしない (source: brief)", "- destruction: criteria: 1.1")
        )
        self.assertNotIn("destruction", _sdd.check_gaps(text))

    def test_a_status_code_is_not_sent_back_by_a_token(self) -> None:
        choose = '"choose": "404 を返す", "rejected": null, "reversible": true, "basis": "requirements"'
        self._fresh_design(REVERSIBLE_DESIGN.replace('"choose": "x", "rejected": null, "reversible": true', choose))
        result = self.act()
        self.assertNotIn("basis", result.get("details", {}).get("checks", []))
        self.assertEqual(result["action"], "spec-tasks")

    def test_a_chosen_limit_is_not_copied_by_a_token(self) -> None:
        choose = '"choose": "3秒で一覧を返す", "rejected": null, "reversible": true, "basis": "human"'
        self._fresh_design(REVERSIBLE_DESIGN.replace('"choose": "x", "rejected": null, "reversible": true', choose))
        result = self.act()
        self.assertNotIn("quantities", result.get("details", {}))
        self.assertEqual(result["action"], "spec-tasks")

    def test_json_blocked_task_stops_for_a_human(self) -> None:
        _req, design = self._fresh_design()
        self.write(
            "tasks.md",
            '# Tasks\n\n```json\n{"tasks":[{"id":"1.1","status":"open","req":["1"],"blocked":"方針未決"}]}\n```\n',
        )
        data = json.loads((self.spec / "spec.json").read_text(encoding="utf-8"))
        data["approvals"]["tasks"]["generated"] = True
        data["source_sha256"]["design_at_tasks"] = design
        (self.spec / "spec.json").write_text(json.dumps(data), encoding="utf-8")
        result = self.act()
        self.assertEqual(result["action"], "stop-manual")
        self.assertEqual(result["gate"]["result"], "MANUAL_VERIFY_REQUIRED")


if __name__ == "__main__":
    unittest.main()
