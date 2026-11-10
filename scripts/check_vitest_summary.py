#!/usr/bin/env python3
"""Fail closed on empty, failed, inconsistent or unexpectedly skipped Vitest reports."""

import argparse
import json
import sys
from pathlib import Path


def matches(path, suffix):
    path = path.replace("\\", "/")
    suffix = suffix.replace("\\", "/").lstrip("/")
    return bool(suffix) and (path == suffix or path.endswith("/" + suffix))


def check(report, minimum, expected_skipped, allowed_skips, required):
    if not isinstance(report, dict) or report.get("success") is not True:
        raise ValueError("Vitest did not report success")
    fields = ("numTotalTests", "numPassedTests", "numFailedTests", "numPendingTests")
    if any(type(report.get(field)) is not int or report[field] < 0 for field in fields):
        raise ValueError("Missing or invalid test counts")
    total, passed, failed, skipped = (report[field] for field in fields)
    if total < minimum or passed == 0 or failed != 0 or skipped != expected_skipped or total != passed + failed + skipped:
        raise ValueError("Test totals, failures or skipped count do not satisfy the gate")
    suites = report.get("testResults")
    if not isinstance(suites, list) or not suites:
        raise ValueError("No test files were discovered")
    observed = {"passed": 0, "failed": 0, "skipped": 0}
    names = set()
    required_passed = set()
    for suite in suites:
        if not isinstance(suite, dict) or not isinstance(suite.get("name"), str) or not isinstance(suite.get("assertionResults"), list):
            raise ValueError("Invalid test file record")
        name = suite["name"].replace("\\", "/")
        if not name or name in names:
            raise ValueError("Empty or duplicate test file record")
        names.add(name)
        for assertion in suite["assertionResults"]:
            if not isinstance(assertion, dict) or not isinstance(assertion.get("title"), str) or not assertion["title"]:
                raise ValueError("Invalid test assertion record")
            status = assertion.get("status")
            if status == "passed":
                observed["passed"] += 1
                required_passed.update(item for item in required if matches(name, item))
            elif status in ("skipped", "pending", "todo"):
                observed["skipped"] += 1
                if not any(matches(name, item) for item in allowed_skips):
                    raise ValueError("Skipped test in an unapproved file")
            elif status == "failed":
                observed["failed"] += 1
            else:
                raise ValueError("Unknown test assertion status")
    if observed != {"passed": passed, "failed": failed, "skipped": skipped}:
        raise ValueError("Per-test outcomes do not match the summary")
    if required_passed != set(required):
        raise ValueError("A required file has no passing tests")
    return {"status": "passed", "tests": total, "passed": passed, "skipped": skipped, "files": len(names)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("report", type=Path)
    parser.add_argument("--min-tests", type=int, default=1)
    parser.add_argument("--expected-skipped", type=int, default=0)
    parser.add_argument("--allow-skipped-file", action="append", default=[])
    parser.add_argument("--require-file", action="append", default=[])
    args = parser.parse_args()
    try:
        if args.min_tests < 1 or args.expected_skipped < 0:
            raise ValueError("Invalid gate thresholds")
        report = json.loads(args.report.read_text(encoding="utf-8"))
        result = check(report, args.min_tests, args.expected_skipped, args.allow_skipped_file, args.require_file)
    except (OSError, ValueError, TypeError) as exc:
        print(json.dumps({"status": "failed", "reason": str(exc)}), file=sys.stderr)
        return 1
    print(json.dumps(result))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
