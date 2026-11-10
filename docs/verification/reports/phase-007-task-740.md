# TASK-740: Codex Adapter runtime package

Candidate: codex/task-720-audited at db83fb9 plus uncommitted remediation changes. Windows, Node 22.19.0 and npm 10.7.0; 2026-11-05.

## Evidence

- REQ-014/015/019/090/092/093/095: the package previously had no Node-resolvable entry point and its build ran only typecheck; the root build omitted it.
- Runtime-import regression before implementation: exit 1, ERR_MODULE_NOT_FOUND. After implementation and root build: both runtime package tests passed, exit 0; the real Node ESM resolver loaded the supervisor export.
- Root npm run build, lint and strict workspace typecheck: exit 0. Adapter build emits source JS and declarations; typecheck retains source and test coverage.
- After build completion, full unit run: 149 files, 334 passed and 6 skipped, exit 0. Contract run: 8 files, 35 passed, exit 0. Skips are not passing evidence.
- TASK-740 pack check and anchored runtime trace before this report: exit 0.

## Limitations

No desktop IPC hookup, real Codex server, model execution, sandbox test, compatibility expansion or H1 acceptance is claimed. The working tree contains other uncommitted remediation changes; this report is not clean-SHA merge evidence.
