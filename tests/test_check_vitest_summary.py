import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

CHECKER = Path(__file__).resolve().parents[1] / "scripts" / "check_vitest_summary.py"


class VitestSummaryGateTests(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.report = Path(self.folder.name) / "result.json"
        self.addCleanup(self.folder.cleanup)

    def run_gate(self, report, *arguments):
        if report is not None:
            self.report.write_text(json.dumps(report), encoding="utf-8")
        return subprocess.run(
            [sys.executable, str(CHECKER), str(self.report), *arguments],
            capture_output=True, text=True, check=False
        )

    def sample(self):
        return {
            "success": True, "numTotalTests": 3, "numPassedTests": 2,
            "numFailedTests": 0, "numPendingTests": 1,
            "testResults": [
                {"name": "C:/repo/a.test.ts", "assertionResults": [
                    {"title": "first", "status": "passed"},
                    {"title": "second", "status": "passed"}]},
                {"name": "C:/repo/db.test.ts", "assertionResults": [
                    {"title": "database", "status": "skipped"}]}
            ]
        }

    def test_accepts_nonempty_explicitly_scoped_skip(self):
        result = self.run_gate(self.sample(), "--min-tests", "3",
                               "--expected-skipped", "1",
                               "--allow-skipped-file", "db.test.ts",
                               "--require-file", "a.test.ts")
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_rejects_missing_or_invalid_report(self):
        self.assertNotEqual(self.run_gate(None).returncode, 0)
        self.report.write_text("{", encoding="utf-8")
        result = subprocess.run([sys.executable, str(CHECKER), str(self.report)], capture_output=True, text=True)
        self.assertNotEqual(result.returncode, 0)

    def test_rejects_zero_tests_and_mismatched_counts(self):
        zero = {"success": True, "numTotalTests": 0, "numPassedTests": 0, "numFailedTests": 0, "numPendingTests": 0, "testResults": []}
        self.assertNotEqual(self.run_gate(zero).returncode, 0)
        report = self.sample()
        report["numPassedTests"] = 3
        self.assertNotEqual(self.run_gate(report, "--expected-skipped", "1", "--allow-skipped-file", "db.test.ts").returncode, 0)

    def test_rejects_failed_and_unapproved_skips(self):
        report = self.sample()
        report["success"] = False
        report["numFailedTests"] = 1
        self.assertNotEqual(self.run_gate(report, "--expected-skipped", "1", "--allow-skipped-file", "db.test.ts").returncode, 0)
        self.assertNotEqual(self.run_gate(self.sample(), "--expected-skipped", "1", "--allow-skipped-file", "other.test.ts").returncode, 0)
        self.assertNotEqual(self.run_gate(self.sample(), "--expected-skipped", "0").returncode, 0)

    def test_rejects_missing_required_test_file(self):
        self.assertNotEqual(self.run_gate(self.sample(), "--expected-skipped", "1",
                                         "--allow-skipped-file", "db.test.ts",
                                         "--require-file", "missing.test.ts").returncode, 0)


if __name__ == "__main__":
    unittest.main()
