#!/usr/bin/env python3
"""Behavior tests for scripts/eval_check.py. Run: python3 scripts/test_eval_check.py"""

from __future__ import annotations

import importlib.util
import sys
import tempfile
import unittest
from pathlib import Path

sys.dont_write_bytecode = True

_spec = importlib.util.spec_from_file_location("eval_check", Path(__file__).resolve().parent / "eval_check.py")
eval_check = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(eval_check)

EXPECT = "# Expect\n\n- E1: requirements.md — 結果がある\n- E2 [absence]: design.md — 余計な結果が無い\n"
REQ = (
    "# Req\n\n## 1. 記録\n\n1. When 利用者が記録する, the システム shall 感想を保持する\n\n"
    "## Quality\n\n"
    "- functional: criteria: 1.1\n"
    "- reliability: criteria: 1.1\n"
    "- usability: criteria: 1.1\n"
    "- performance: out: 条件なし (source: grill:perf)\n"
    "- maintainability: criteria: 1.1\n"
    "- security: criteria: 1.1\n\n"
    "## Checks\n\n"
    "- leakage: out: 個人データは扱わない (source: brief)\n"
    "- destruction: out: 削除や上書きはしない (source: brief)\n"
    "- lockout: out: 拒否後も操作を続けられる (source: brief)\n"
    "- rewrite: out: 後から変えられないデータの形は依頼に無い (source: brief)\n\n"
    "## Screens\n\n"
    "- out: 新しい画面は無い (source: brief)\n"
)


class EvalCheckTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        root = Path(self.tmp.name)
        self.cases = root / "cases"
        (self.cases / "demo").mkdir(parents=True)
        (self.cases / "demo" / "expect.md").write_text(EXPECT, encoding="utf-8")
        self.results = root / "results"

    def tearDown(self) -> None:
        self.tmp.cleanup()

    def run_dir(self, name: str, score: str, req: str = REQ) -> Path:
        run = self.results / name
        run.mkdir(parents=True)
        (run / "requirements.md").write_text(req, encoding="utf-8")
        (run / "score.md").write_text("case: demo\n\n" + score, encoding="utf-8")
        return run

    def test_quoted_evidence_passes(self) -> None:
        run = self.run_dir("20260926-0100-demo", '- E1: pass — "感想を保持する" (requirements.md)\n- E2: pass — none found (design.md)\n')
        report, failures = eval_check.check(run, self.cases)
        self.assertEqual(failures, [])
        self.assertIn("score: 2/2", report)

    def test_quote_missing_from_the_artifact_fails(self) -> None:
        run = self.run_dir("20260926-0100-demo", '- E1: pass — "削除できる" (requirements.md)\n- E2: pass — none found (design.md)\n')
        _report, failures = eval_check.check(run, self.cases)
        self.assertTrue(any("見つからない" in f for f in failures))

    def test_unscored_item_fails(self) -> None:
        run = self.run_dir("20260926-0100-demo", '- E1: pass — "感想を保持する" (requirements.md)\n')
        _report, failures = eval_check.check(run, self.cases)
        self.assertIn("E2: 採点がない", failures)

    def test_regression_from_the_previous_run_fails(self) -> None:
        self.run_dir("20260926-0100-demo", '- E1: pass — "感想を保持する" (requirements.md)\n- E2: pass — none found (design.md)\n')
        run = self.run_dir("20260926-0200-demo", "- E1: fail — 結果が無い\n- E2: pass — none found (design.md)\n")
        _report, failures = eval_check.check(run, self.cases)
        self.assertIn("E1: 前回 pass から fail に下がった", failures)

    def test_unsettled_quality_is_not_a_mechanical_failure(self) -> None:
        req = REQ.replace(" (source: grill:perf)", "")
        run = self.run_dir("20260926-0100-demo", '- E1: pass — "感想を保持する" (requirements.md)\n- E2: pass — none found (design.md)\n', req)
        _report, failures = eval_check.check(run, self.cases)
        self.assertFalse(any("performance" in f or "quality" in f for f in failures))


if __name__ == "__main__":
    unittest.main()
