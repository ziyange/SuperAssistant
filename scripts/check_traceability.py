#!/usr/bin/env python3
"""Verify that every documented requirement has one complete traceability row."""

from __future__ import annotations

import argparse
import json
import re
from collections import Counter
from pathlib import Path
from typing import Dict, List, Sequence, Tuple


REQUIREMENT_HEADING = re.compile(r"^#{2,6}\s+(REQ-\d{3,})\b", re.MULTILINE)
REQUIRED_COLUMNS = (
    "REQ",
    "Source",
    "Engineering",
    "Phase",
    "Task Pack",
    "Acceptance",
    "Verification",
)


def _cells(line: str) -> List[str]:
    return [cell.strip() for cell in line.strip().strip("|").split("|")]


def _is_separator(cells: Sequence[str]) -> bool:
    return bool(cells) and all(re.fullmatch(r":?-{3,}:?", cell.replace(" ", "")) for cell in cells)


def parse_matrix(text: str) -> Tuple[List[Dict[str, str]], List[str]]:
    """Return rows from the first table containing all required columns."""
    lines = text.splitlines()
    issues: List[str] = []
    for index, line in enumerate(lines):
        if not line.lstrip().startswith("|"):
            continue
        header = _cells(line)
        if not all(column in header for column in REQUIRED_COLUMNS):
            continue
        if index + 1 >= len(lines) or not _is_separator(_cells(lines[index + 1])):
            issues.append("traceability table header is not followed by a Markdown separator row")
            return [], issues

        rows: List[Dict[str, str]] = []
        for row_line in lines[index + 2 :]:
            if not row_line.lstrip().startswith("|"):
                break
            values = _cells(row_line)
            if _is_separator(values):
                continue
            if len(values) != len(header):
                issues.append(f"traceability row has {len(values)} cells; expected {len(header)}: {row_line.strip()}")
                continue
            rows.append(dict(zip(header, values)))
        return rows, issues
    return [], ["no traceability table contains the required columns"]


def check_traceability(requirements_path: Path, matrix_path: Path) -> List[str]:
    issues: List[str] = []
    try:
        requirements_text = requirements_path.read_text(encoding="utf-8")
        matrix_text = matrix_path.read_text(encoding="utf-8")
    except (OSError, UnicodeError) as exc:
        return [f"cannot read traceability input: {exc}"]

    requirement_ids = REQUIREMENT_HEADING.findall(requirements_text)
    if not requirement_ids:
        issues.append("requirements document contains no REQ-### headings")
    duplicate_requirements = [req_id for req_id, count in Counter(requirement_ids).items() if count > 1]
    for req_id in duplicate_requirements:
        issues.append(f"duplicate requirement heading: {req_id}")

    rows, parse_issues = parse_matrix(matrix_text)
    issues.extend(parse_issues)
    row_ids = [row.get("REQ", "") for row in rows]
    requirement_set = set(requirement_ids)

    for req_id, count in Counter(row_ids).items():
        if not req_id:
            issues.append("traceability row has an empty REQ cell")
        elif count > 1:
            issues.append(f"duplicate traceability rows for {req_id}")
        if req_id and req_id not in requirement_set:
            issues.append(f"unknown requirement in traceability matrix: {req_id}")

    row_by_id = {row.get("REQ", ""): row for row in rows}
    for req_id in sorted(requirement_set):
        row = row_by_id.get(req_id)
        if row is None:
            issues.append(f"missing traceability row for {req_id}")
            continue
        for column in REQUIRED_COLUMNS[1:]:
            if not row.get(column, "").strip():
                issues.append(f"{req_id} has an empty {column} cell")
        phase = row.get("Phase", "")
        if phase and not re.search(r"\bPHASE-\d{3}\b", phase):
            issues.append(f"{req_id} Phase must reference PHASE-###")
        task_pack = row.get("Task Pack", "")
        if task_pack and not (re.search(r"\bTASK-\d{3,}\b", task_pack) or "phase plan" in task_pack.lower()):
            issues.append(f"{req_id} Task Pack must reference TASK-### or an explicit phase-plan handoff")
        acceptance = row.get("Acceptance", "")
        if acceptance and not re.search(r"\bAC-[A-Z0-9-]+\b", acceptance):
            issues.append(f"{req_id} Acceptance must reference AC-* evidence")
        verification = row.get("Verification", "")
        if verification and not re.search(r"\bSCN-[A-Z0-9-]+\b", verification):
            issues.append(f"{req_id} Verification must reference SCN-* scenario evidence")

    return sorted(set(issues))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--requirements", required=True, type=Path)
    parser.add_argument("--matrix", required=True, type=Path)
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()

    issues = check_traceability(args.requirements, args.matrix)
    payload = {
        "status": "passed" if not issues else "failed",
        "requirements": str(args.requirements),
        "matrix": str(args.matrix),
        "total_issues": len(issues),
        "issues": issues,
    }
    if args.json:
        print(json.dumps(payload, ensure_ascii=False, indent=2))
    elif issues:
        print("Traceability check failed:")
        for issue in issues:
            print(f"- {issue}")
    else:
        print("Traceability check passed.")
    return 1 if issues else 0


if __name__ == "__main__":
    raise SystemExit(main())
