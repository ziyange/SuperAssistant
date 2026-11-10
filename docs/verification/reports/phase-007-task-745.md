# TASK-745: Fail-closed synthetic cancellation

Candidate: codex/task-720-audited at db83fb9 plus uncommitted remediation. Windows; Node 22.19.0 and npm 10.7.0; 2026-11-09 (Asia/Shanghai).

## Evidence

REQ-029/030/031/033/090/093/098. The synthetic adapter no longer accepts Boolean flags as cancellation proof and never releases a lease after unconfirmed termination. A failed interrupt still attempts termination but retains the lease. Termination or lease release failures result in CANCELLATION_INCOMPLETE.

- Before the fix, four contract tests failed: early release after failed termination, forged Boolean completion, failed interrupt path, and invalid process identity.
- Focused cancellation contract: 6 passed, exit 0. Full contract: 8 files, 39 passed, exit 0.
- Root build, lint and workspace typecheck: exit 0. Full unit suite after build: 149 files, 354 passed and 6 skipped; exit 0. Skips are not acceptance evidence.
- Documentation links, Task Pack structure, REQ tracing, five schemas, anchored runtime trace and git diff --check passed before this report.

## Limits

The transport remains synthetic and is not connected to a real Codex App Server. Actual OS process identity, descendants, bounded termination deadlines and durable release evidence require separate work; this does not prove full cancellation acceptance, Electron sandbox behavior, H1 completion or merge readiness.
