# TASK-743: Local Workspace owner binding

Candidate: codex/task-720-audited at db83fb9 plus uncommitted remediation. Windows; Node 22.19.0 and npm 10.7.0. Validation 2026-11-09 (Asia/Shanghai).

## Evidence

REQ-001/024/025/027/028/090/094/095: local Grant issuance and Attempt creation/replay now require a trusted local principal matching both the active Workspace owner and Grant actor. Test composition injects identities and clocks; the production default is local-owner.

- Prior red run: two failures demonstrated unauthorized Grant issuance and cross-principal execution. Targeted rerun: 3 files, 20 tests passed, including forged actor, non-owner, locked Workspace and replay; exit 0.
- Root build, lint and workspace typecheck: exit 0. After build, unit suite: 149 files, 349 passed and 6 skipped; exit 0. Contract suite: 8 files, 35 passed; exit 0. Skips are not passing evidence.
- Governance: 248 Markdown files checked; 90 Task Packs structurally valid; REQ tracing, five schemas, anchored runtime trace, 29 governance unit tests and git diff --check passed.
- Previous audit lock identified PID 40740, no longer present; lock manager safely recovered the stale lock after the runtime trace returned exit 0.

## Limits

This local-only principal rule does not implement Team RBAC or establish the initial worktree/resource policy. No desktop dispatch, real Codex execution, Electron sandbox acceptance, H1 completion or clean-SHA merge evidence is claimed.
