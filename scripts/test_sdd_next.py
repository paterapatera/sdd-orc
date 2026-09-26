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


REQ = "# Req\n\nWhen a user signs in, the system shall open a session.\n"


def grill(verdict: str, target: str) -> str:
    return f"# Grill\n\n**VERDICT:** {verdict}\n**Target SHA256:** {target}\n"


def req_review(verdict: str, status: str, before: str, after: str, findings: str = "none") -> str:
    return (
        "## Verdict\n"
        f"- VERDICT: {verdict}\n"
        f"- Input SHA256: {before}\n"
        f"- Output SHA256: {after}\n\n"
        f"## Findings\n{findings}\n\n"
        "## Phase Gate\n"
        f"- STATUS: {status}\n"
    )


def design_review(verdict: str, status: str, req: str, design: str) -> str:
    return (
        "## Verdict\n"
        f"- VERDICT: {verdict}\n"
        f"- Requirements SHA256: {req}\n"
        f"- Design SHA256: {design}\n\n"
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
            req_review("NO-GO", "NOT_VERIFIED", req, req, "Critical. rollback target: grill"),
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

    def test_grill_stops_after_three_rounds_each(self) -> None:
        req = self.write("requirements.md", REQ + "\n- Open question: 誰が使うか\n")
        self.write("req-grill.md", grill("WAITING", req) + "AI round: 3\nHuman round: 3\n")
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

    def _fresh_design(self) -> tuple[str, str]:
        req = self._ready_requirements()
        design = self.write("design.md", "# Design\n")
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
            '# Tasks\n\n```json\n{"tasks":[{"id":"1.1","status":"open","blocked":null}]}\n```\n',
        )
        data = json.loads((self.spec / "spec.json").read_text(encoding="utf-8"))
        data["approvals"]["tasks"]["generated"] = True
        data["source_sha256"]["design_at_tasks"] = design
        (self.spec / "spec.json").write_text(json.dumps(data), encoding="utf-8")
        result = self.act()
        self.assertEqual(result["action"], "auto-approve")
        self.assertEqual(result["gate"]["result"], "VERIFIED")

    def test_json_blocked_task_stops_for_a_human(self) -> None:
        _req, design = self._fresh_design()
        self.write(
            "tasks.md",
            '# Tasks\n\n```json\n{"tasks":[{"id":"1.1","status":"open","blocked":"方針未決"}]}\n```\n',
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
