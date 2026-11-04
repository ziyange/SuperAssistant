import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from check_docs_links import check_docs_links


class DocsDiscoveryTests(unittest.TestCase):
    def test_hidden_ancestor_does_not_hide_docs_and_broken_link(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp) / '.worktrees' / 'task' / 'docs'
            root.mkdir(parents=True)
            (root / 'index.md').write_text('[missing](missing.md)', encoding='utf-8')
            result = check_docs_links(root)
            self.assertEqual(result['total_files'], 1)
            self.assertEqual(result['status'], 'failed')
            self.assertEqual(result['total_issues'], 1)

    def test_empty_directory_is_not_a_passing_scan(self):
        with tempfile.TemporaryDirectory() as temp:
            result = check_docs_links(Path(temp))
            self.assertNotEqual(result['status'], 'passed')
            self.assertGreater(result['total_issues'], 0)
