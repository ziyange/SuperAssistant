# TASK-744: H1 Project lease and fencing

Candidate: codex/task-720-audited at db83fb9 plus uncommitted remediation. Windows; Node 22.19.0 and npm 10.7.0; 2026-11-09 (Asia/Shanghai).

## Evidence

REQ-016/027/030/031/060/090/094/098. H1 execution accepts the Project resource key emitted by GitWorktreeService. A shared SQLite lease acquisition path rejects invalid/stale fences and any unreleased lease under the canonical or known legacy alias. Grant consumption and Task/Attempt/lease/outbox creation remain transactional.

- Red run: four failures reproduced wrong Project key, zero/negative fences and overlapping active leases. A separate legacy-key test failed before alias handling; reverse-alias access also failed before its fix.
- Green focused regression: 3 files, 25 tests passed, exit 0. Includes active and quarantined conflict, Grant rollback, legacy alias, release and higher-fence successor.
- Root build, lint and workspace typecheck: exit 0. Full unit suite after build: 149 files, 354 passed and 6 skipped; exit 0. Contract suite: 8 files, 35 passed; exit 0. Skips are not acceptance evidence.
- Governance: 250 Markdown files, 91 Task Pack structural checks, REQ tracing, five schemas, anchored runtime trace, 29 governance tests and git diff --check passed before this report.
- First Task Pack structural check rejected angle-bracket notation as an unresolved placeholder; wording was corrected and the check passed.

## Limits

This is a coarse local Project-level lease, not proof of task-worktree creation, operating-system isolation, write-time fencing or safe process-termination-before-release. Historical keys beyond the documented alias require explicit reconciliation. Real Codex, Electron sandbox validation, H1 end-to-end acceptance and merge remain unproven.
