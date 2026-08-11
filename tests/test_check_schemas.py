from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path


SCRIPTS = Path(__file__).resolve().parents[1] / "scripts"
sys.path.insert(0, str(SCRIPTS))

from check_schemas import EXPECTED_SCHEMAS, check_schemas  # noqa: E402


class SchemaCheckTests(unittest.TestCase):
    def test_accepts_complete_valid_schema_set(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            for name in EXPECTED_SCHEMAS:
                (root / name).write_text(
                    json.dumps({"$schema": "http://json-schema.org/draft-07/schema#", "type": "object"}),
                    encoding="utf-8",
                )

            self.assertEqual([], check_schemas(root))

    def test_reports_missing_and_invalid_schema(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            for name in EXPECTED_SCHEMAS[:-1]:
                payload = {"type": "not-a-real-json-schema-type"} if name == EXPECTED_SCHEMAS[0] else {"type": "object"}
                (root / name).write_text(json.dumps(payload), encoding="utf-8")

            issues = check_schemas(root)

            self.assertTrue(any(EXPECTED_SCHEMAS[-1] in issue and "missing" in issue for issue in issues))
            self.assertTrue(any(EXPECTED_SCHEMAS[0] in issue and "invalid" in issue for issue in issues))

    def test_reports_malformed_json(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            for name in EXPECTED_SCHEMAS:
                (root / name).write_text("{" if name == EXPECTED_SCHEMAS[2] else '{"type": "object"}', encoding="utf-8")

            issues = check_schemas(root)

            self.assertTrue(any(EXPECTED_SCHEMAS[2] in issue and "JSON" in issue for issue in issues))


if __name__ == "__main__":
    unittest.main()
