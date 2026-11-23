#!/usr/bin/env python3
"""Verify every contiguous task scope from a fixed audit anchor onward."""
import argparse
import json
import re
import subprocess
import sys
from pathlib import Path


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--audit', default='docs/delivery/permission-audit.log')
    parser.add_argument('--trace', default='docs/delivery/execution-trace.json')
    parser.add_argument('--packs', default='docs/delivery/tasks')
    parser.add_argument('--schemas', default='references/schemas.md')
    parser.add_argument('--expansions', default='docs/delivery/expansions.json')
    parser.add_argument('--start', default='task-823-pack-001')
    args = parser.parse_args()
    try:
        entries = json.loads(Path(args.audit).read_text(encoding='utf-8'))
        if not isinstance(entries, list):
            raise ValueError('audit is not a list')
        indices = [i for i, entry in enumerate(entries) if isinstance(entry, dict) and entry.get('tx_id') == args.start]
        if len(indices) != 1:
            raise ValueError('starting anchor missing or duplicated')
        groups = []
        previous = -1
        for entry in entries[indices[0]:]:
            if not isinstance(entry, dict) or not isinstance(entry.get('tx_id'), str):
                raise ValueError('malformed transaction')
            tx = entry['tx_id']
            match = re.fullmatch(r'task-(\d+)-[a-z0-9-]+', tx)
            if not match:
                raise ValueError('unassigned transaction')
            number = int(match.group(1))
            if number != previous:
                if number <= previous or not re.fullmatch(r'task-\d+-(?:pack|write)-001', tx):
                    raise ValueError('repeated, out-of-order or missing task start')
                expected = 'docs/delivery/tasks/TASK-' + match.group(1) + '.md'
                if entry.get('action_type') != 'FILE_WRITE' or entry.get('status') != 'COMMITTED' or entry.get('normalized_path') != expected:
                    raise ValueError('invalid task start')
                pack = Path(args.packs) / ('TASK-' + match.group(1) + '.md')
                if not pack.is_file():
                    raise ValueError('task pack missing')
                groups.append((tx, pack))
                previous = number
        if not groups or groups[0][0] != args.start:
            raise ValueError('no task scopes')
        verifier = Path(__file__).resolve().with_name('verify_runtime_trace.py')
        for index, (start, pack) in enumerate(groups):
            command = [sys.executable, str(verifier), '--trace', args.trace, '--permission-log', args.audit,
                       '--task-pack', str(pack), '--mode', 'plan', '--schemas', args.schemas,
                       '--expansions', args.expansions, '--task-start-tx', start, '--require-task-evidence', '--json']
            if index + 1 < len(groups):
                command += ['--task-end-tx', groups[index + 1][0]]
            result = subprocess.run(command, check=False)
            if result.returncode != 0:
                return result.returncode
        print(f'Validated {len(groups)} contiguous task scopes from {args.start}.')
        return 0
    except (OSError, ValueError, TypeError, json.JSONDecodeError) as error:
        print(f'Audit history invalid: {error}', file=sys.stderr)
        return 3


if __name__ == '__main__':
    sys.exit(main())
