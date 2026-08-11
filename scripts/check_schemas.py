#!/usr/bin/env python3
"""Validate the five standalone document-first governance JSON Schemas."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import List


EXPECTED_SCHEMAS = (
    "AuditLogSchema.json",
    "ExecutionTraceSchema.json",
    "ExpansionSchema.json",
    "TaskPackSchema.json",
    "PainPointCardSchema.json",
)


def check_schemas(schema_dir: Path) -> List[str]:
    issues: List[str] = []
    try:
        import jsonschema
    except ImportError:
        return ["jsonschema is required to validate standalone schemas"]

    for filename in EXPECTED_SCHEMAS:
        path = schema_dir / filename
        if not path.is_file():
            issues.append(f"missing schema: {filename}")
            continue
        try:
            schema = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, UnicodeError, json.JSONDecodeError) as exc:
            issues.append(f"malformed JSON in {filename}: {exc}")
            continue
        try:
            validator = jsonschema.validators.validator_for(schema)
            validator.check_schema(schema)
        except jsonschema.exceptions.SchemaError as exc:
            issues.append(f"invalid schema {filename}: {exc.message}")

    return sorted(issues)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("schema_dir", type=Path)
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()

    issues = check_schemas(args.schema_dir)
    payload = {
        "status": "passed" if not issues else "failed",
        "schema_dir": str(args.schema_dir),
        "expected": list(EXPECTED_SCHEMAS),
        "total_issues": len(issues),
        "issues": issues,
    }
    if args.json:
        print(json.dumps(payload, ensure_ascii=False, indent=2))
    elif issues:
        print("Schema check failed:")
        for issue in issues:
            print(f"- {issue}")
    else:
        print("Schema check passed.")
    return 1 if issues else 0


if __name__ == "__main__":
    raise SystemExit(main())
