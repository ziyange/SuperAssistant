import hashlib
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class AuditHistoryTests(unittest.TestCase):
    def test_successive_scopes_and_fail_closed_history(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            packs = root / 'packs'
            packs.mkdir()
            for number in (823, 824, 825):
                (packs / f'TASK-{number}.md').write_text(
                    f'## Allowed Files\n- docs/delivery/tasks/TASK-{number}.md\n- file-{number}.txt\n', encoding='utf-8')
            entries, results = [], []
            def append(tx, path):
                prev = entries[-1]['intent_hash'] if entries else 'GENESIS'
                digest = hashlib.sha256(f'{prev}:FILE_WRITE:{path}:{tx}'.encode()).hexdigest()
                entries.append({'tx_id': tx, 'timestamp': '2026-11-04T00:00:00Z', 'action_type': 'FILE_WRITE', 'normalized_path': path, 'prev_hash': prev, 'intent_hash': digest, 'status': 'COMMITTED'})
                results.append({'tx_id': tx, 'iteration_index': 1, 'timestamp': '2026-11-04T00:00:00Z', 'action_type': 'FILE_WRITE', 'normalized_path': path, 'intent_hash': digest, 'result_status': 'COMPLETED', 'ignored_candidates': []})
            for number in (823, 824, 825):
                append(f'task-{number}-pack-001', f'docs/delivery/tasks/TASK-{number}.md')
                append(f'task-{number}-write-002', f'file-{number}.txt')
            audit, trace = root / 'audit.json', root / 'trace.json'
            def run():
                audit.write_text(json.dumps(entries), encoding='utf-8')
                trace.write_text(json.dumps(results), encoding='utf-8')
                return subprocess.run([sys.executable, str(ROOT / 'scripts/check_task_audit_history.py'), '--audit', str(audit), '--trace', str(trace), '--packs', str(packs), '--schemas', str(ROOT / 'references/schemas.md'), '--expansions', str(root / 'missing.json'), '--start', 'task-823-pack-001'], capture_output=True, text=True)
            result = run()
            self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
            def rechain():
                prev = 'GENESIS'
                for entry, result in zip(entries, results):
                    digest = hashlib.sha256(f"{prev}:FILE_WRITE:{entry['normalized_path']}:{entry['tx_id']}".encode()).hexdigest()
                    entry['prev_hash'] = prev
                    entry['intent_hash'] = digest
                    result['intent_hash'] = digest
                    result['normalized_path'] = entry['normalized_path']
                    prev = digest
            for index in (1, 3, 5):
                original = entries[index]['normalized_path']
                entries[index]['normalized_path'] = 'forbidden.txt'
                rechain()
                self.assertEqual(run().returncode, 2, 'a validly chained out-of-scope write must fail')
                entries[index]['normalized_path'] = original
                rechain()
            entries[-1]['normalized_path'] = 'forbidden.txt'
            self.assertNotEqual(run().returncode, 0, 'tampering must fail')
            entries[-1]['normalized_path'] = 'file-825.txt'
            entries[-1]['status'] = 'PENDING'
            self.assertNotEqual(run().returncode, 0, 'pending entries must fail')
            entries[-1]['status'] = 'COMMITTED'
            entries[-1]['tx_id'] = 'task-823-write-999'
            self.assertNotEqual(run().returncode, 0, 'reopened older task must fail')

    def test_missing_history_is_not_success(self):
        result = subprocess.run([sys.executable, str(ROOT / 'scripts/check_task_audit_history.py'), '--audit', 'missing.json'], capture_output=True, text=True)
        self.assertNotEqual(result.returncode, 0)
