from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path


SCRIPTS = Path(__file__).resolve().parents[1] / "scripts"
sys.path.insert(0, str(SCRIPTS))

from check_task_pack import REQUIRED_HEADINGS, check_task_pack  # noqa: E402


def task_pack(allowed_file: str = "src/exact.ts", confirmation: str = "user_confirmed: true") -> str:
    sections = {
        "Status": "APPROVED\n\nMAX_ITERATIONS: 3\n\n" + confirmation,
        "Requirement IDs": "REQ-001",
        "Objective": "Deliver one bounded behavior.",
        "Context Pack": "docs/product.md",
        "Must Read": "- docs/product.md",
        "Allowed Files": f"- {allowed_file}",
        "Forbidden Files": "- Any path not explicitly allowed above.",
        "Interfaces / Contracts": "Preserve the documented port contract.",
        "Data Constraints": "Persist stable identifiers.",
        "UI Constraints": "Expose no internal provider identifier.",
        "Implementation Requirements": "Implement only the stated objective.",
        "Test Requirements": "Run the named focused test command.",
        "Acceptance Criteria": "The focused test passes with observable evidence.",
        "Done Definition": "Facts and verification evidence agree.",
        "Risks": "Security scope is deny by default.",
        "Output Required": "Return changed files and command results.",
    }
    rendered = ["# TASK-900: Policy fixture"]
    for heading in REQUIRED_HEADINGS:
        rendered.extend(["", f"## {heading}", "", sections[heading]])
    return "\n".join(rendered) + "\n"


class TaskPackPolicyTests(unittest.TestCase):
    def check(self, content: str) -> list[str]:
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / "TASK-900.md"
            path.write_text(content, encoding="utf-8")
            return check_task_pack(path)

    def test_accepts_exact_allowlist_and_confirmation(self) -> None:
        self.assertEqual([], self.check(task_pack()))

    def test_rejects_missing_true_confirmation(self) -> None:
        issues = self.check(task_pack(confirmation="risk_reviewed: true"))
        self.assertTrue(any("user_confirmed" in issue for issue in issues))

    def test_rejects_recursive_allowlist_pattern(self) -> None:
        issues = self.check(task_pack(allowed_file="src/**/*.ts"))
        self.assertTrue(any("wildcard" in issue for issue in issues))

    def test_rejects_unknown_status(self) -> None:
        issues = self.check(task_pack().replace("APPROVED", "READY", 1))
        self.assertTrue(any("Status" in issue for issue in issues))


if __name__ == "__main__":
    unittest.main()
