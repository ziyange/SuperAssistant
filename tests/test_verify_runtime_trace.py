import sys
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
import verify_runtime_trace as verifier


class RuntimeInputsTests(unittest.TestCase):
    def test_missing_or_malformed_trace_is_not_success(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            audit = root / 'audit.json'
            audit.write_text('[]', encoding='utf-8')
            trace = root / 'trace.json'
            for content in (None, '{invalid'):
                if content is not None:
                    trace.write_text(content, encoding='utf-8')
                code, _ = verifier.run_verification(str(trace), str(audit), str(ROOT / 'docs/delivery/tasks/TASK-720.md'), 'plan', 1, str(ROOT / 'references/schemas.md'), str(root / 'expansions.json'))
                self.assertEqual(code, 3)

    def test_missing_jsonschema_is_not_success(self):
        with tempfile.TemporaryDirectory() as temp, patch.object(verifier, 'HAS_JSONSCHEMA', False):
            root = Path(temp)
            trace, audit = root / 'trace.json', root / 'audit.json'
            trace.write_text('[]', encoding='utf-8')
            audit.write_text('[]', encoding='utf-8')
            code, _ = verifier.run_verification(str(trace), str(audit), str(ROOT / 'docs/delivery/tasks/TASK-720.md'), 'plan', 1, str(ROOT / 'references/schemas.md'), str(root / 'expansions.json'))
            self.assertEqual(code, 3)

    def test_missing_or_malformed_audit_is_not_success(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            trace, audit = root / 'trace.json', root / 'audit.json'
            trace.write_text('[]', encoding='utf-8')
            for content in (None, '{invalid'):
                if content is not None:
                    audit.write_text(content, encoding='utf-8')
                code, _ = verifier.run_verification(str(trace), str(audit), str(ROOT / 'docs/delivery/tasks/TASK-720.md'), 'plan', 1, str(ROOT / 'references/schemas.md'), str(root / 'expansions.json'))
                self.assertEqual(code, 3)

    def test_missing_task_pack_is_not_success(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            trace, audit = root / 'trace.json', root / 'audit.json'
            trace.write_text('[]', encoding='utf-8')
            audit.write_text('[]', encoding='utf-8')
            code, _ = verifier.run_verification(str(trace), str(audit), str(root / 'missing.md'), 'plan', 1, str(ROOT / 'references/schemas.md'), str(root / 'expansions.json'))
            self.assertEqual(code, 3)

    def test_empty_task_allowlist_is_not_success(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            trace, audit, pack = root / 'trace.json', root / 'audit.json', root / 'TASK-000.md'
            trace.write_text('[]', encoding='utf-8')
            audit.write_text('[]', encoding='utf-8')
            pack.write_text('# Empty task\n## Allowed Files\n', encoding='utf-8')
            code, _ = verifier.run_verification(str(trace), str(audit), str(pack), 'plan', 1, str(ROOT / 'references/schemas.md'), str(root / 'expansions.json'))
            self.assertEqual(code, 3)

    def test_malformed_existing_expansion_is_not_success(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            trace, audit, expansion = root / 'trace.json', root / 'audit.json', root / 'expansions.json'
            trace.write_text('[]', encoding='utf-8')
            audit.write_text('[]', encoding='utf-8')
            expansion.write_text('{invalid', encoding='utf-8')
            code, _ = verifier.run_verification(str(trace), str(audit), str(ROOT / 'docs/delivery/tasks/TASK-720.md'), 'plan', 1, str(ROOT / 'references/schemas.md'), str(expansion))
            self.assertEqual(code, 3)

    def test_malformed_standalone_schema_does_not_fall_back(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            schemas = root / 'schemas'
            schemas.mkdir()
            (schemas / 'ExecutionTraceSchema.json').write_text('{invalid', encoding='utf-8')
            markdown = root / 'schemas.md'
            markdown.write_text('// schema-id: ExecutionTraceSchema\n{"type":"object"}', encoding='utf-8')
            self.assertIsNone(verifier.load_schema_from_markdown(str(markdown), 'ExecutionTraceSchema'))

    def test_result_without_audit_intent_cannot_pass(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            trace, audit = root / 'trace.json', root / 'audit.json'
            trace.write_text(json.dumps([{'tx_id': 'orphan', 'iteration_index': 1, 'timestamp': '2026-11-04T00:00:00Z', 'action_type': 'COMMAND_EXEC', 'normalized_path': 'N/A', 'intent_hash': 'a' * 64, 'result_status': 'COMPLETED', 'ignored_candidates': []}]), encoding='utf-8')
            audit.write_text('[]', encoding='utf-8')
            code, result = verifier.run_verification(str(trace), str(audit), str(ROOT / 'docs/delivery/tasks/TASK-720.md'), 'plan', 1, str(ROOT / 'references/schemas.md'), str(root / 'expansions.json'))
            self.assertEqual(code, 4)
            self.assertEqual(result['reason_details']['orphan'], 'RESULT_WITHOUT_INTENT')

    def test_result_cannot_change_the_intent_action_or_path(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            trace, audit = root / 'trace.json', root / 'audit.json'
            intent_hash = verifier.compute_intent_hash('GENESIS', 'FILE_WRITE', 'docs/README.md', 'tx-1')
            audit.write_text(json.dumps([{'tx_id': 'tx-1', 'timestamp': '2026-11-04T00:00:00Z', 'action_type': 'FILE_WRITE', 'normalized_path': 'docs/README.md', 'prev_hash': 'GENESIS', 'intent_hash': intent_hash, 'status': 'COMMITTED'}]), encoding='utf-8')
            trace.write_text(json.dumps([{'tx_id': 'tx-1', 'iteration_index': 1, 'timestamp': '2026-11-04T00:00:00Z', 'action_type': 'FILE_WRITE', 'normalized_path': 'docs/other.md', 'intent_hash': intent_hash, 'result_status': 'COMPLETED', 'ignored_candidates': []}]), encoding='utf-8')
            code, _ = verifier.run_verification(str(trace), str(audit), str(ROOT / 'docs/delivery/tasks/TASK-720.md'), 'plan', 1, str(ROOT / 'references/schemas.md'), str(root / 'expansions.json'))
            self.assertEqual(code, 5)

    def test_task_specific_gate_rejects_historical_only_evidence(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            trace, audit = root / 'trace.json', root / 'audit.json'
            trace.write_text('[]', encoding='utf-8')
            audit.write_text('[]', encoding='utf-8')
            code, result = verifier.run_verification(str(trace), str(audit), str(ROOT / 'docs/delivery/tasks/TASK-720.md'), 'plan', 1, str(ROOT / 'references/schemas.md'), str(root / 'expansions.json'), require_task_evidence=True)
            self.assertNotEqual(code, 0)
            self.assertEqual(result['reason'], 'TASK_EVIDENCE_MISSING')

    def test_task_specific_gate_accepts_matching_audited_write(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            trace, audit = root / 'trace.json', root / 'audit.json'
            path, tx_id = 'docs/README.md', 'task-720-write-1'
            intent_hash = verifier.compute_intent_hash('GENESIS', 'FILE_WRITE', path, tx_id)
            audit.write_text(json.dumps([{'tx_id': tx_id, 'timestamp': '2026-11-04T00:00:00Z', 'action_type': 'FILE_WRITE', 'normalized_path': path, 'prev_hash': 'GENESIS', 'intent_hash': intent_hash, 'status': 'COMMITTED'}]), encoding='utf-8')
            trace.write_text(json.dumps([{'tx_id': tx_id, 'iteration_index': 1, 'timestamp': '2026-11-04T00:00:00Z', 'action_type': 'FILE_WRITE', 'normalized_path': path, 'intent_hash': intent_hash, 'result_status': 'COMPLETED', 'ignored_candidates': []}]), encoding='utf-8')
            code, result = verifier.run_verification(str(trace), str(audit), str(ROOT / 'docs/delivery/tasks/TASK-720.md'), 'plan', 1, str(ROOT / 'references/schemas.md'), str(root / 'expansions.json'), require_task_evidence=True)
            self.assertEqual(code, 0)
            self.assertEqual(result['reason'], 'SUCCESS')

    def test_duplicate_transaction_results_are_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            trace, audit = root / 'trace.json', root / 'audit.json'
            tx_id, path = 'task-720-write-1', 'docs/README.md'
            intent_hash = verifier.compute_intent_hash('GENESIS', 'FILE_WRITE', path, tx_id)
            audit.write_text(json.dumps([{'tx_id': tx_id, 'timestamp': '2026-11-04T00:00:00Z', 'action_type': 'FILE_WRITE', 'normalized_path': path, 'prev_hash': 'GENESIS', 'intent_hash': intent_hash, 'status': 'COMMITTED'}]), encoding='utf-8')
            result = {'tx_id': tx_id, 'iteration_index': 1, 'timestamp': '2026-11-04T00:00:00Z', 'action_type': 'FILE_WRITE', 'normalized_path': path, 'intent_hash': intent_hash, 'result_status': 'COMPLETED', 'ignored_candidates': []}
            trace.write_text(json.dumps([result, result]), encoding='utf-8')
            code, _ = verifier.run_verification(str(trace), str(audit), str(ROOT / 'docs/delivery/tasks/TASK-720.md'), 'plan', 1, str(ROOT / 'references/schemas.md'), str(root / 'expansions.json'))
            self.assertNotEqual(code, 0)
