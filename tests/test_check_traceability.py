from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path


SCRIPTS = Path(__file__).resolve().parents[1] / "scripts"
sys.path.insert(0, str(SCRIPTS))

from check_traceability import check_traceability  # noqa: E402


class TraceabilityCheckTests(unittest.TestCase):
    def write_fixture(self, requirements: str, matrix: str) -> tuple[Path, Path, tempfile.TemporaryDirectory]:
        temp = tempfile.TemporaryDirectory()
        root = Path(temp.name)
        requirements_path = root / "requirements.md"
        matrix_path = root / "matrix.md"
        requirements_path.write_text(requirements, encoding="utf-8")
        matrix_path.write_text(matrix, encoding="utf-8")
        return requirements_path, matrix_path, temp

    def test_accepts_one_complete_row_per_requirement(self) -> None:
        requirements, matrix, temp = self.write_fixture(
            "# Requirements\n\n### REQ-001 — Register a project\nStatus: Approved\n",
            "| REQ | Source | Engineering | Phase | Task Pack | Acceptance | Verification |\n"
            "|---|---|---|---|---|---|---|\n"
            "| REQ-001 | Project section | data-model.md | PHASE-001 | TASK-104 | AC-PROJECT-01 | SCN-ROUTE-01 |\n",
        )
        self.addCleanup(temp.cleanup)

        self.assertEqual([], check_traceability(requirements, matrix))

    def test_reports_missing_requirement_and_empty_verification(self) -> None:
        requirements, matrix, temp = self.write_fixture(
            "### REQ-001 — First\n### REQ-002 — Second\n",
            "| REQ | Source | Engineering | Phase | Task Pack | Acceptance | Verification |\n"
            "|---|---|---|---|---|---|---|\n"
            "| REQ-001 | Source | architecture.md | PHASE-001 | TASK-101 | AC-01 |  |\n",
        )
        self.addCleanup(temp.cleanup)

        issues = check_traceability(requirements, matrix)

        self.assertTrue(any("REQ-002" in issue and "missing" in issue for issue in issues))
        self.assertTrue(any("REQ-001" in issue and "Verification" in issue for issue in issues))

    def test_reports_unknown_and_duplicate_rows(self) -> None:
        requirements, matrix, temp = self.write_fixture(
            "### REQ-001 — First\n",
            "| REQ | Source | Engineering | Phase | Task Pack | Acceptance | Verification |\n"
            "|---|---|---|---|---|---|---|\n"
            "| REQ-001 | S | E | PHASE-001 | TASK-101 | AC-01 | SCN-01 |\n"
            "| REQ-001 | S | E | PHASE-001 | TASK-101 | AC-01 | SCN-01 |\n"
            "| REQ-999 | S | E | PHASE-001 | TASK-101 | AC-99 | SCN-99 |\n",
        )
        self.addCleanup(temp.cleanup)

        issues = check_traceability(requirements, matrix)

        self.assertTrue(any("duplicate" in issue and "REQ-001" in issue for issue in issues))
        self.assertTrue(any("unknown" in issue and "REQ-999" in issue for issue in issues))


if __name__ == "__main__":
    unittest.main()
