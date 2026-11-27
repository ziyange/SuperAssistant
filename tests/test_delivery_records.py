import hashlib
import base64
import importlib.util
import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FROZEN = 'docs/delivery/permission-audit.log'
FROZEN_PATHS = (FROZEN, 'docs/delivery/execution-trace.json', 'docs/delivery/expansions.json')


class DeliveryRecordsTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.assertTrue((ROOT / 'scripts/check_delivery_records.py').is_file(),
                        '缺少新开发记录门禁，无法执行历史冻结和范围检查')
        self.spec = importlib.util.spec_from_file_location('delivery', ROOT / 'scripts/check_delivery_records.py')
        self.assertTrue(self.spec is not None and self.spec.loader is not None,
                        'the delivery gate must be loadable')
        self.gate = importlib.util.module_from_spec(self.spec)
        self.spec.loader.exec_module(self.gate)
        for name in FROZEN_PATHS:
            self.write(name, '[{"tx_id":"old-001"}]\n')
        self.write('docs/delivery/tasks/TASK-857.md', self.pack())
        self.write('docs/delivery/development-log.md', self.record())
        self.write('code.txt', 'initial\n')
        self.baseline = {
            'schema_version': 1, 'baseline_commit': 'a' * 40, 'migration_task': 'TASK-857',
            'frozen': {name: {'sha256': hashlib.sha256(b'[{"tx_id":"old-001"}]\n').hexdigest(),
                             'bytes': 22, 'entries': 1} for name in FROZEN_PATHS}, 'preexisting': {}}
        self.write_manifest()

    def write(self, name, text):
        path = self.root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open('w', encoding='utf-8', newline='\n') as stream:
            stream.write(text)

    def write_manifest(self):
        self.write('docs/delivery/logging-baseline.json', json.dumps(self.baseline))

    def pack(self, status='APPROVED', allowed='code.txt'):
        return ('# TASK-857: 记录迁移\n\n## Status\n' + status +
                '\nMAX_ITERATIONS: 3\nuser_confirmed: true\n\n## Allowed Files\n- ' + allowed + '\n')

    def record(self, kind='阶段成果', status='PLANNED', detail='迁移结果等待验证', evidence='code.txt'):
        return ('# 开发记录\n\n## 记录 DEV-857\n- 任务：TASK-857\n- 日期：2026-11-27\n- 类型：' + kind +
                '\n- 结论：' + status + '\n- 说明：' + detail +
                '\n- 验证状态：PLANNED\n- 验证：待运行\n- 证据：[' + evidence + '](../../' + evidence + ')\n- 遗留：仍需实际验收\n')

    def check(self):
        return self.gate.validate_materials(self.root)

    def test_frozen_history_and_chinese_record_are_valid(self):
        self.assertEqual(self.check(), [])

    def test_freezing_does_not_rewrite_history_during_check(self):
        before = (self.root / FROZEN).read_bytes()
        self.check()
        self.assertEqual((self.root / FROZEN).read_bytes(), before)

    def test_changed_history_is_rejected(self):
        self.write(FROZEN, '[{"tx_id":"new-001"}]\n')
        self.assertTrue(self.check())

    def test_autocrlf_checkout_preserves_frozen_bytes_without_disabling_diff(self):
        attributes = ROOT / '.gitattributes'
        self.assertTrue(attributes.is_file(), '缺少跨平台证据保真属性')
        self.write('.gitattributes', attributes.read_text(encoding='utf-8'))
        self.write('docs/delivery/logging-baseline.json', json.dumps(self.baseline, indent=2) + '\n')
        before = (self.root / 'docs/delivery/logging-baseline.json').read_bytes()
        for number in (852, 853, 854):
            self.write(f'docs/delivery/tasks/TASK-{number}.md', '# preserved history\n')
        self.git('init', '-q')
        self.git('config', 'core.autocrlf', 'true')
        self.git('add', '.')
        self.git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'fixture')
        self.git('checkout-index', '--all', '--force')
        for name in FROZEN_PATHS:
            self.assertEqual((self.root / name).read_bytes(), b'[{"tx_id":"old-001"}]\n')
        self.assertEqual((self.root / 'docs/delivery/logging-baseline.json').read_bytes(), before)
        for number in (852, 853, 854):
            self.assertEqual((self.root / f'docs/delivery/tasks/TASK-{number}.md').read_bytes(), b'# preserved history\n')
        self.write(FROZEN, '[{"tx_id":"old-001"}]\n\n')
        result = subprocess.run(['git', '-C', str(self.root), 'diff', '--check'], capture_output=True)
        self.assertNotEqual(result.returncode, 0, '保真属性不能禁用空白错误检查')

    def test_eof_normalization_keeps_exact_original_evidence(self):
        name = 'docs/delivery/tasks/TASK-857.md'
        raw = (self.pack() + '\n\n').encode('utf-8')
        self.baseline['preexisting'][name] = hashlib.sha256(raw).hexdigest()
        self.baseline['format_sources'] = {name: base64.b64encode(raw).decode('ascii')}
        self.write_manifest()
        self.write(name, raw.decode('utf-8'))
        self.assertEqual(self.check(), [])
        self.write(name, raw.rstrip(b'\r\n').decode('utf-8') + '\n')
        self.assertEqual(self.check(), [])
        self.write(name, raw.decode('utf-8').replace('code.txt', 'other.txt'))
        self.assertTrue(self.check(), '不能用格式规范化悄悄修改历史范围')

    def test_corrupt_or_unbound_format_source_fails(self):
        name = 'docs/delivery/tasks/TASK-857.md'
        self.baseline['preexisting'][name] = 'a' * 64
        for value in ('!!!!', base64.b64encode(b'wrong source').decode('ascii')):
            self.baseline['format_sources'] = {name: value}
            self.write_manifest()
            self.assertTrue(self.check())
        self.baseline['format_sources'] = {'other.txt': base64.b64encode(b'other').decode('ascii')}
        self.write_manifest()
        self.assertTrue(self.check())

    def test_missing_or_corrupt_baseline_fails_closed(self):
        for contents in ('', '{', '{}', '[]'):
            with self.subTest(contents=contents):
                self.write('docs/delivery/logging-baseline.json', contents)
                self.assertTrue(self.check())
        (self.root / 'docs/delivery/logging-baseline.json').unlink()
        self.assertTrue(self.check())

    def test_bad_history_count_and_empty_freeze_are_rejected(self):
        self.baseline['frozen'][FROZEN]['entries'] = 2
        self.write_manifest()
        self.assertTrue(self.check())
        self.baseline['frozen'] = {}
        self.write_manifest()
        self.assertTrue(self.check())

    def test_missing_english_duplicate_and_invalid_records_are_rejected(self):
        for contents in ('# 开发记录\n', self.record(detail='implemented everything'),
                         self.record(kind='日常修改'), self.record() + self.record(),
                         self.record(evidence='missing.txt')):
            with self.subTest(contents=contents[:60]):
                self.write('docs/delivery/development-log.md', contents)
                self.assertTrue(self.check())

    def test_pass_cannot_cite_planned_verification(self):
        self.write('docs/delivery/development-log.md', self.record(status='PASS'))
        self.assertTrue(self.check())

    def test_explicit_failed_verification_cannot_be_pass(self):
        for text in ('全部测试未通过', '验证失败'):
            self.write('docs/delivery/development-log.md', self.record(status='PASS')
                       .replace('验证状态：PLANNED', '验证状态：PASS').replace('验证：待运行', '验证：' + text))
            self.assertTrue(self.check(), text)

    def test_verified_chinese_milestone_can_pass(self):
        self.write('docs/delivery/development-log.md', self.record(status='PASS')
                   .replace('验证状态：PLANNED', '验证状态：PASS')
                   .replace('验证：待运行', '验证：本地测试通过，失败 0 项'))
        self.assertEqual(self.check(), [])

    def test_missing_one_required_frozen_file_fails(self):
        del self.baseline['frozen'][FROZEN_PATHS[1]]
        self.write_manifest()
        self.assertTrue(self.check())

    def test_historical_exhausted_pack_is_not_new_authority(self):
        self.write('docs/delivery/tasks/TASK-855.md', self.pack().replace('TASK-857', 'TASK-855'))
        with self.assertRaises(ValueError):
            self.gate.allowed_files(self.root / 'docs/delivery/tasks/TASK-855.md')

    def test_repository_escape_is_rejected(self):
        for path in ('../outside', '/absolute', 'C:/absolute', 'docs/../frozen.json'):
            self.baseline['frozen'] = {path: {'sha256': 'a' * 64, 'bytes': 1, 'entries': 1}}
            self.write_manifest()
            self.assertTrue(self.check())

    def test_ordinary_allowed_edit_does_not_need_a_new_record(self):
        issues = self.gate.scope_issues({'code.txt'}, {'code.txt'}, {}, {})
        self.assertEqual(issues, [])

    def test_out_of_scope_file_cannot_be_hidden(self):
        self.assertTrue(self.gate.scope_issues({'code.txt', 'secret.txt'}, {'code.txt'}, {}, {}))

    def test_preexisting_change_is_exempt_only_at_same_content(self):
        self.assertEqual(self.gate.scope_issues({'old.txt'}, set(), {'old.txt': 'same'}, {'old.txt': 'same'}), [])
        self.assertTrue(self.gate.scope_issues({'old.txt'}, set(), {'old.txt': 'new'}, {'old.txt': 'same'}))

    def git(self, *args):
        return subprocess.check_output(['git', '-C', str(self.root), *args], stderr=subprocess.STDOUT)

    def test_git_scan_includes_staged_unstaged_and_untracked(self):
        self.git('init', '-q')
        self.write('source.txt', 'rename content\n' * 20)
        self.git('add', '.')
        self.git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'base')
        base = self.git('rev-parse', 'HEAD').decode().strip()
        self.write('code.txt', 'staged\n')
        self.git('add', 'code.txt')
        self.write('code.txt', 'initial\n')
        self.write('unknown.txt', 'untracked\n')
        self.git('mv', 'source.txt', 'destination.txt')
        changes = self.gate.git_changes(self.root, base)
        self.assertIn('code.txt', changes)
        self.assertIn('unknown.txt', changes)
        self.assertIn('source.txt', changes, '不能漏掉重命名导致的源文件删除')
        self.assertIn('destination.txt', changes)

    def test_draft_unconfirmed_and_wildcard_scope_fail(self):
        path = self.root / 'docs/delivery/tasks/TASK-857.md'
        for text in (self.pack('DRAFT'), self.pack('COMPLETED'), self.pack('IN_PROGRESS'),
                     self.pack().replace('true', 'false'), self.pack(allowed='src/**')):
            self.write('docs/delivery/tasks/TASK-857.md', text)
            with self.assertRaises(ValueError):
                self.gate.allowed_files(path)

    def test_ci_cannot_reuse_unchanged_old_record_as_current_scope(self):
        before = self.record()
        self.assertEqual(self.gate.changed_tasks(before, before), set())
        self.assertEqual(self.gate.changed_tasks('', before), {'TASK-857'})

    def test_malformed_extra_heading_cannot_escape_record_scan(self):
        self.write('docs/delivery/development-log.md', self.record() + '\n## 记录 ???\n- 说明：不允许漏扫\n')
        self.assertTrue(self.check())

    def test_boolean_schema_version_is_not_a_valid_integer(self):
        self.baseline['schema_version'] = True
        self.write_manifest()
        self.assertTrue(self.check())

    def test_cli_rejects_iteration_head_and_baseline_changes(self):
        self.git('init', '-q')
        self.git('add', '.')
        self.git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'base')
        def run(*args, explicit=True):
            env = dict(os.environ, PYTHONUTF8='0', PYTHONIOENCODING='gbk')
            result = subprocess.run([sys.executable, str(ROOT / 'scripts/check_delivery_records.py'),
                                     '--root', str(self.root),
                                     *(['--task-pack', 'docs/delivery/tasks/TASK-857.md'] if explicit else []),
                                     '--json', *args], capture_output=True, text=True, encoding='utf-8', env=env)
            return result.returncode, json.loads(result.stdout)
        record_before = (self.root / 'docs/delivery/development-log.md').read_bytes()
        self.write('code.txt', 'ordinary edit\n')
        code, payload = run()
        self.assertEqual(code, 0, payload)
        self.assertEqual((self.root / 'docs/delivery/development-log.md').read_bytes(), record_before)
        self.assertNotEqual(run('--iteration', '4')[0], 0)
        self.assertNotEqual(run('--head', 'f' * 40)[0], 0)
        base = self.git('rev-parse', 'HEAD').decode().strip()
        self.git('add', 'code.txt')
        self.git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid',
                 'commit', '-qm', 'ordinary implementation', '-m', 'Task: TASK-857')
        head = self.git('rev-parse', 'HEAD').decode().strip()
        code, payload = run('--base', base, '--head', head, explicit=False)
        self.assertEqual(code, 0, payload)
        self.assertEqual((self.root / 'docs/delivery/development-log.md').read_bytes(), record_before)
        self.write('elsewhere.md', self.pack())
        self.assertNotEqual(run('--task-pack', 'elsewhere.md')[0], 0)
        (self.root / 'elsewhere.md').unlink()
        self.baseline['migration_task'] = 'TASK-999'
        self.write_manifest()
        code, payload = run()
        self.assertNotEqual(code, 0)
        self.assertTrue(any('禁止静默重置' in item for item in payload['issues']))

    def test_inherited_snapshot_cannot_hide_outgoing_or_staged_work(self):
        args = ({'old.txt'}, set(), {'old.txt': 'same'}, {'old.txt': 'same'})
        self.assertEqual(self.gate.scope_issues(*args), [])
        self.assertTrue(self.gate.scope_issues(*args, outgoing={'old.txt'}))

    def test_ci_candidate_must_be_clean(self):
        self.git('init', '-q')
        self.git('add', '.')
        self.git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'base')
        head = self.git('rev-parse', 'HEAD').decode().strip()
        self.write('code.txt', 'not in candidate\n')
        result = subprocess.run([sys.executable, str(ROOT / 'scripts/check_delivery_records.py'),
                                 '--root', str(self.root), '--head', head,
                                 '--task-pack', 'docs/delivery/tasks/TASK-857.md', '--json'],
                                capture_output=True, text=True, encoding='utf-8')
        self.assertNotEqual(result.returncode, 0, result.stdout)

    def test_real_git_snapshot_exempts_only_untouched_dirt(self):
        self.write('old.txt', 'original\n')
        self.write('docs/delivery/tasks/TASK-857.md', self.pack(allowed='code.txt\n- docs/delivery/logging-baseline.json'))
        self.git('init', '-q')
        self.git('add', 'code.txt', 'old.txt', 'docs/delivery/tasks/TASK-857.md',
                 'docs/delivery/development-log.md', *FROZEN_PATHS)
        self.git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'base')
        base = self.git('rev-parse', 'HEAD').decode().strip()
        self.write('old.txt', 'retained WIP\n')
        self.baseline['baseline_commit'] = base
        self.baseline['preexisting'] = {'old.txt': hashlib.sha256(b'retained WIP\n').hexdigest()}
        self.write_manifest()
        def run():
            result = subprocess.run([sys.executable, str(ROOT / 'scripts/check_delivery_records.py'),
                                     '--root', str(self.root), '--base', base,
                                     '--task-pack', 'docs/delivery/tasks/TASK-857.md', '--json'],
                                    capture_output=True, text=True, encoding='utf-8')
            return result.returncode, json.loads(result.stdout)
        code, payload = run()
        self.assertEqual(code, 0, payload)
        self.git('add', 'old.txt')
        code, payload = run()
        self.assertNotEqual(code, 0)
        self.assertIn('越界文件：old.txt', payload['issues'])
        self.git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid',
                 'commit', '-qm', 'unrelated change')
        code, payload = run()
        self.assertNotEqual(code, 0)
        self.assertIn('越界文件：old.txt', payload['issues'])

    def test_ci_can_carry_historical_pack_as_data_not_authority(self):
        self.write('docs/delivery/tasks/TASK-857.md', self.pack(allowed='docs/delivery/tasks/TASK-855.md'))
        self.git('init', '-q')
        self.git('add', '.')
        self.git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'base')
        base = self.git('rev-parse', 'HEAD').decode().strip()
        self.write('docs/delivery/tasks/TASK-855.md', self.pack().replace('TASK-857', 'TASK-855'))
        self.git('add', 'docs/delivery/tasks/TASK-855.md')
        self.git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid',
                 'commit', '-qm', 'preserve historical metadata', '-m', 'Task: TASK-857')
        def run():
            head = self.git('rev-parse', 'HEAD').decode().strip()
            result = subprocess.run([sys.executable, str(ROOT / 'scripts/check_delivery_records.py'),
                                     '--root', str(self.root), '--base', base, '--head', head, '--json'],
                                    capture_output=True, text=True, encoding='utf-8')
            return result.returncode, json.loads(result.stdout)
        code, payload = run()
        self.assertEqual(code, 0, payload)
        self.assertEqual(payload['tasks'], ['TASK-857'])
        self.write('code.txt', 'historical pack cannot authorize new code\n')
        self.git('add', 'code.txt')
        self.git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid',
                 'commit', '-qm', 'invalid historical authority', '-m', 'Task: TASK-855')
        self.assertNotEqual(run()[0], 0)


if __name__ == '__main__':
    unittest.main()
