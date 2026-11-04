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


def check_reference_targets(requirements_path: Path, matrix_path: Path, docs_root: Path) -> List[str]:
    """Verify named Task Packs and scenarios resolve, without asserting test execution."""
    try:
        requirements = requirements_path.read_text(encoding='utf-8')
        matrix = matrix_path.read_text(encoding='utf-8')
        catalog_path = docs_root / 'verification' / 'scenarios.md'
        catalog = catalog_path.read_text(encoding='utf-8') if catalog_path.is_file() else ''
    except (OSError, UnicodeError) as exc:
        return [f'cannot read reference input: {exc}']
    rows, issues = parse_matrix(matrix)
    lifecycle_scenarios = set(re.findall(r'^#{2,6}\s+(SCN-[A-Z0-9-]+)\b', catalog, re.MULTILINE))
    headings = list(REQUIREMENT_HEADING.finditer(requirements))
    scenarios_by_requirement = {}
    acceptance_requirements = set()
    for index, heading in enumerate(headings):
        end = headings[index + 1].start() if index + 1 < len(headings) else len(requirements)
        section = requirements[heading.end():end]
        scenarios_by_requirement[heading.group(1)] = set(re.findall(r'\bSCN-[A-Z0-9-]+\b', section))
        if re.search(r'^-\s+Acceptance:\s*$', section, re.MULTILINE):
            acceptance_requirements.add(heading.group(1))
    for row in rows:
        req_id = row.get('REQ', '')
        for phase in re.findall(r'\bPHASE-\d{3}\b', row.get('Phase', '')):
            if not (docs_root / 'delivery' / f'{phase.lower()}.md').is_file():
                issues.append(f'{req_id} references missing phase {phase}')
        for acceptance in re.findall(r'\bAC-REQ-\d{3}\b', row.get('Acceptance', '')):
            if acceptance != f'AC-{req_id}' or req_id not in acceptance_requirements:
                issues.append(f'{req_id} references missing or unrelated acceptance {acceptance}')
        for task in re.findall(r'\bTASK-\d+\b', row.get('Task Pack', '')):
            if not (docs_root / 'delivery' / 'tasks' / f'{task}.md').is_file():
                issues.append(f"{row.get('REQ', '')} references missing Task Pack {task}")
        for scenario in re.findall(r'\bSCN-[A-Z0-9-]+\b', row.get('Verification', '')):
            if scenario not in scenarios_by_requirement.get(row.get('REQ', ''), set()) and scenario not in lifecycle_scenarios:
                issues.append(f"{row.get('REQ', '')} references missing or unrelated scenario {scenario}")
    return sorted(set(issues))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--requirements", required=True, type=Path)
    parser.add_argument("--matrix", required=True, type=Path)
    parser.add_argument("--json", action="store_true")
    parser.add_argument("--resolve-references", action="store_true", help="Check named Task Packs and scenarios exist under the requirements document directory")
    parser.add_argument("--expected-count", type=int, help="Require this many distinct REQ headings")
    args = parser.parse_args()

    issues = check_traceability(args.requirements, args.matrix)
    if args.expected_count is not None:
        try:
            actual = len(set(REQUIREMENT_HEADING.findall(args.requirements.read_text(encoding='utf-8'))))
            if actual != args.expected_count:
                issues.append(f'expected {args.expected_count} requirements, found {actual}')
        except (OSError, UnicodeError) as exc:
            issues.append(f'cannot count requirements: {exc}')
    if args.resolve_references:
        issues.extend(check_reference_targets(args.requirements, args.matrix, args.requirements.parent))
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
