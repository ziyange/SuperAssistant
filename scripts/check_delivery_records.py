#!/usr/bin/env python3
"""只读开发记录门禁：历史冻结、中文成果／问题、精确 Git 范围。

不写日志、不执行测试；结构通过不证明功能正确或历史记录完整。
"""
import argparse
import base64
import datetime
import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path, PurePosixPath

BASELINE = 'docs/delivery/logging-baseline.json'
RECORDS = 'docs/delivery/development-log.md'
HEX = re.compile(r'[0-9a-f]{64}')
COMMIT = re.compile(r'[0-9a-f]{40}')
HAN = re.compile(r'[\u3400-\u9fff]')
FROZEN_PATHS = {'docs/delivery/permission-audit.log', 'docs/delivery/execution-trace.json',
                'docs/delivery/expansions.json'}


def safe_path(name):
    if (not isinstance(name, str) or not name or '\\' in name or ':' in name
            or any(c in name for c in '*?[]') or name.startswith('/')
            or any(p in ('', '.', '..') for p in name.split('/'))):
        raise ValueError('非法仓库相对路径：' + str(name))
    return str(PurePosixPath(name))


def local_file(root, name):
    path = root / safe_path(name)
    if not path.resolve().is_relative_to(root.resolve()):
        raise ValueError('文件链接逃出仓库：' + name)
    return path


def format_source(data, name, encoded):
    safe_path(name)
    if (not re.fullmatch(r'docs/delivery/tasks/TASK-\d{3,}\.md', name)
            or name not in data['preexisting'] or not isinstance(encoded, str)
            or len(encoded) > 2 * 1024 * 1024):
        raise ValueError('历史格式源未绑定或过大：' + name)
    raw = base64.b64decode(encoded, validate=True)
    raw.decode('utf-8')
    if hashlib.sha256(raw).hexdigest() != data['preexisting'][name]:
        raise ValueError('历史格式源哈希不匹配：' + name)
    return raw


def read_baseline(root):
    data = json.loads((root / BASELINE).read_text(encoding='utf-8'))
    if (not isinstance(data, dict) or type(data.get('schema_version')) is not int
            or data.get('schema_version') != 1
            or not COMMIT.fullmatch(str(data.get('baseline_commit', '')))
            or not re.fullmatch(r'TASK-\d{3,}', str(data.get('migration_task', '')))
            or not isinstance(data.get('preexisting'), dict)
            or not isinstance(data.get('frozen'), dict) or set(data['frozen']) != FROZEN_PATHS):
        raise ValueError('冻结基线结构损坏或为空')
    for name, digest in data['preexisting'].items():
        safe_path(name)
        if not isinstance(digest, str) or not HEX.fullmatch(digest):
            raise ValueError('既有文件指纹无效')
    for name, info in data['frozen'].items():
        safe_path(name)
        if (not isinstance(info, dict) or not HEX.fullmatch(str(info.get('sha256', '')))
                or type(info.get('bytes')) is not int or info['bytes'] <= 0
                or type(info.get('entries')) is not int or info['entries'] <= 0):
            raise ValueError('冻结文件元数据无效：' + name)
    sources = data.get('format_sources', {})
    if not isinstance(sources, dict):
        raise ValueError('历史格式源必须为映射')
    for name, encoded in sources.items():
        format_source(data, name, encoded)
    return data


def records(text):
    result = {}
    for match in re.finditer(r'^## 记录 ([A-Z0-9-]+)\s*\n(.*?)(?=^## |\Z)', text, re.M | re.S):
        identity, body = match.groups()
        if identity in result:
            raise ValueError('重复开发记录：' + identity)
        fields = {}
        for key, value in re.findall(r'^- ([^：\n]+)：([^\n]*)$', body, re.M):
            if key in fields:
                raise ValueError('重复记录字段：' + key)
            fields[key] = value.strip()
        result[identity] = (fields, body)
    if len(re.findall(r'^## 记录(?:\s|$)[^\n]*', text, re.M)) != len(result):
        raise ValueError('存在未识别的开发记录标题，禁止漏扫')
    return result


def validate_materials(root):
    issues = []
    try:
        baseline = read_baseline(root)
        for name, encoded in baseline.get('format_sources', {}).items():
            raw = format_source(baseline, name, encoded)
            current = local_file(root, name).read_bytes()
            if current not in (raw, raw.rstrip(b'\r\n') + b'\n'):
                issues.append('历史文档改动超出 EOF 规范化：' + name)
        for name, expected in baseline['frozen'].items():
            raw = local_file(root, name).read_bytes()
            data = json.loads(raw.decode('utf-8'))
            if (hashlib.sha256(raw).hexdigest() != expected['sha256']
                    or len(raw) != expected['bytes'] or not isinstance(data, list)
                    or len(data) != expected['entries']):
                issues.append('历史冻结校验失败：' + name)
        entries = records((root / RECORDS).read_text(encoding='utf-8'))
        if not entries:
            issues.append('开发记录为空，不能以零扫描报成功')
        required = {'任务', '日期', '类型', '结论', '说明', '验证状态', '验证', '证据', '遗留'}
        for identity, (fields, _) in entries.items():
            if any(not fields.get(key) for key in required):
                issues.append('开发记录字段缺失：' + identity)
                continue
            if (fields['类型'] not in ('阶段成果', '问题')
                    or fields['结论'] not in ('PASS', 'REQUEST_CHANGES', 'BLOCKED', 'PLANNED')
                    or any(not HAN.search(fields[key]) for key in ('说明', '验证', '遗留'))):
                issues.append('记录类型、结论或中文说明无效：' + identity)
            datetime.date.fromisoformat(fields['日期'])
            task = fields['任务']
            if (not re.fullmatch(r'TASK-\d{3,}', task)
                    or not (root / 'docs/delivery/tasks' / (task + '.md')).is_file()):
                issues.append('记录任务不存在：' + identity)
            if fields['验证状态'] not in ('PASS', 'REQUEST_CHANGES', 'BLOCKED', 'PLANNED'):
                issues.append('验证状态无效：' + identity)
            if fields['结论'] == 'PASS' and (fields['验证状态'] != 'PASS' or re.search(
                    r'待运行|待验证|未运行|未通过|验证失败|测试失败|检查失败|PLANNED|BLOCKED|REQUEST_CHANGES|失败\s*[:：]?\s*[1-9]', fields['验证'])):
                issues.append('PASS 引用了未通过的验证：' + identity)
            links = re.findall(r'\[[^\]]+\]\(([^)]+)\)', fields['证据'])
            if not links:
                issues.append('缺少证据链接：' + identity)
            for link in links:
                link = link.strip('<>')
                if link.startswith('https://'):
                    continue  # 链接存在不等于远程 CI 已验证。
                if ':' in link or link.startswith('/'):
                    issues.append('非法证据地址：' + identity)
                    continue
                target = ((root / RECORDS).parent / link.split('#', 1)[0]).resolve()
                if not target.is_relative_to(root.resolve()) or not target.is_file():
                    issues.append('证据缺失或逃出仓库：' + identity)
    except (OSError, ValueError, TypeError, UnicodeError) as error:
        issues.append('材料不可验证：' + str(error))
    return issues


def allowed_files(path, minimum_task=857):
    text = path.read_text(encoding='utf-8')
    status = re.search(r'^## Status\s*\n([^\n]+)', text, re.M)
    limits = re.findall(r'^MAX_ITERATIONS: ([1-9]|10)\s*$', text, re.M)
    identity = re.fullmatch(r'TASK-(\d{3,})\.md', path.name)
    if (not identity or int(identity.group(1)) < minimum_task
            or not re.search(r'^# ' + re.escape(path.stem) + r': ', text, re.M)
            or not status or status.group(1).strip() != 'APPROVED'
            or not re.search(r'^user_confirmed: true\s*$', text, re.M) or len(limits) != 1):
        raise ValueError('任务未批准、未确认或迭代边界无效：' + path.name)
    matches = re.findall(r'^## Allowed Files\s*\n(.*?)(?=^## |\Z)', text, re.M | re.S)
    if len(matches) != 1:
        raise ValueError('任务文件范围缺失或重复：' + path.name)
    lines = [line.strip() for line in matches[0].splitlines() if line.strip()]
    if not lines or any(not line.startswith('- ') for line in lines):
        raise ValueError('任务必须逐个列出文件')
    return {safe_path(line[2:]) for line in lines}


def scope_issues(changed, allowed, current, preexisting, outgoing=None):
    outgoing = outgoing or set()
    return ['越界文件：' + name for name in sorted(changed)
            if name not in allowed and not (name not in outgoing and name in preexisting
                                            and current.get(name) == preexisting[name])]


def git(root, *args):
    return subprocess.check_output(['git', '-C', str(root), *args], stderr=subprocess.PIPE)


def git_changes(root, base, head=None):
    if not COMMIT.fullmatch(base) or (head and not COMMIT.fullmatch(head)):
        raise ValueError('必须使用完整提交 SHA')
    commands = [('diff', '--no-renames', '--name-only', '-z', base, head or '--'),
                ('diff', '--no-renames', '--cached', '--name-only', '-z', base),
                ('diff', '--no-renames', '--name-only', '-z'),
                ('ls-files', '--others', '--exclude-standard', '-z')]
    changed = set()
    for command in commands:
        changed.update(p for p in git(root, *command).decode('utf-8').split('\0') if p)
    return changed


def blob(root, ref, name):
    result = subprocess.run(['git', '-C', str(root), 'show', ref + ':' + name],
                            stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False)
    if result.returncode == 0:
        return result.stdout
    # Distinguish absent paths from invalid refs or a broken Git repository.
    if ref:
        git(root, 'rev-parse', '--verify', ref + '^{commit}')
    else:
        git(root, 'rev-parse', '--git-dir')
    return None


def changed_tasks(before, after):
    old, new = records(before), records(after)
    return {fields['任务'] for identity, (fields, body) in new.items()
            if identity not in old or old[identity][1] != body}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', default='.')
    parser.add_argument('--base', help='Git 检查的完整基线 SHA，默认 HEAD')
    parser.add_argument('--head', help='CI 候选完整 SHA，必须等于当前 HEAD')
    parser.add_argument('--task-pack', help='本地活动 Task Pack 的仓库相对路径')
    parser.add_argument('--iteration', type=int, default=1)
    parser.add_argument('--json', action='store_true')
    args = parser.parse_args()
    root = Path(args.root).resolve()
    issues = validate_materials(root)
    checked = 0
    tasks = set()
    try:
        baseline = read_baseline(root)
        actual_head = git(root, 'rev-parse', 'HEAD').decode().strip()
        base = args.base or actual_head
        if args.head and args.head != actual_head:
            raise ValueError('候选提交与实际 HEAD 不一致')
        if args.head and git_changes(root, actual_head):
            raise ValueError('CI 候选必须干净；工作补丁不能冒充提交 SHA 的证据')
        changed = git_changes(root, base, args.head)
        checked = len(changed)
        previous_baseline = blob(root, base, BASELINE)
        if previous_baseline is not None and previous_baseline != (root / BASELINE).read_bytes():
            issues.append('禁止静默重置历史基线；需要单独批准迁移')
        current = {}
        for name in changed:
            path = local_file(root, name)
            current[name] = hashlib.sha256(path.read_bytes()).hexdigest() if path.is_file() else None
        inherited = baseline['preexisting'] if base == baseline['baseline_commit'] else {}
        # Only untouched dirt can be exempt, never staged or outgoing committed data.
        staged = set(filter(None, git(root, 'diff', '--no-renames', '--cached', '--name-only', '-z').decode().split('\0')))
        committed = set(filter(None, git(root, 'diff', '--no-renames', '--name-only', '-z', base, actual_head).decode().split('\0')))
        inherited = {name: digest for name, digest in inherited.items() if name not in staged | committed}
        new_changes = {name for name in changed if not (name in inherited and current[name] == inherited[name])}
        minimum_task = int(baseline['migration_task'].split('-')[1])
        if args.task_pack:
            if not re.fullmatch(r'docs/delivery/tasks/TASK-\d{3,}\.md', args.task_pack):
                raise ValueError('活动 Task Pack 必须位于规范任务目录')
            pack = local_file(root, args.task_pack)
            tasks.add(pack.stem)
            packs = [pack]
        else:
            previous = blob(root, base, RECORDS)
            tasks = changed_tasks(previous.decode('utf-8') if previous else '', (root / RECORDS).read_text(encoding='utf-8'))
            # Historical/closed packs are data, not implicit new authority.
            # Their paths still need coverage by a current approved allowlist.
            for name in new_changes:
                match = re.fullmatch(r'docs/delivery/tasks/TASK-(\d{3,})\.md', name)
                if match and int(match.group(1)) >= minimum_task:
                    path = local_file(root, name)
                    if path.is_file() and re.search(r'^## Status\s*\nAPPROVED\s*\n', path.read_text(encoding='utf-8'), re.M):
                        tasks.add(path.stem)
            # Existing approved tasks need not edit logs merely to identify a commit.
            messages = git(root, 'log', '--format=%B', base + '..' + actual_head).decode('utf-8')
            tasks.update(re.findall(r'^Task:[ \t]*(TASK-\d{3,})[ \t]*\r?$', messages, re.M))
            packs = [root / 'docs/delivery/tasks' / (task + '.md') for task in sorted(tasks)]
        allowed = set()
        for pack in packs:
            allowed.update(allowed_files(pack, minimum_task))
            maximum = int(re.search(r'^MAX_ITERATIONS: (\d+)\s*$', pack.read_text(encoding='utf-8'), re.M).group(1))
            if not 1 <= args.iteration <= maximum:
                issues.append('任务迭代上限超出：' + pack.stem)
        issues.extend(scope_issues(changed, allowed, current, inherited, outgoing=staged | committed))
    except (OSError, ValueError, TypeError, UnicodeError, subprocess.SubprocessError) as error:
        issues.append('Git 范围不可验证：' + str(error))
    payload = {'status': 'failed' if issues else 'passed', 'issues': issues,
               'checked_paths': checked, 'tasks': sorted(tasks), 'historical_acceptance': 'NOT_ACCEPTED',
               'note': '仅校验保存材料、记录结构与文件范围，不证明产品验收或历史完整性。'}
    sys.stdout.reconfigure(encoding='utf-8')
    print(json.dumps(payload, ensure_ascii=False, indent=2))
    return 1 if issues else 0


if __name__ == '__main__':
    sys.exit(main())
