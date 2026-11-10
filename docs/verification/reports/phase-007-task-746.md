# TASK-746: Bounded synthetic cancellation

Candidate: codex/task-720-audited at db83fb9 plus uncommitted remediation. Windows; Node 22.19.0 and npm 10.7.0; 2026-11-09 (Asia/Shanghai).

## Evidence

REQ-029/030/031/033/090/093/098. Synthetic cancellation uses a monotonic deadline: interrupt is bounded to five seconds and the whole sequence to fifteen. Timeouts produce CANCELLATION_INCOMPLETE; failed interrupt or termination never releases the lease, and a timed-out release is not automatically repeated.

- Fake-timer red run: all three hung-stage tests failed because operations did not settle. Final focused contract: 11 passed, including exact five-second interruption and a late release outcome; exit 0.
- Root build and workspace typecheck: exit 0. Full unit suite: 149 files, 354 passed and 6 skipped; exit 0. Full contract: 8 files, 44 passed; exit 0. Skips do not constitute acceptance.
- Initial lint found a type-only test callback declaration; after a scoped comment correction, lint and the contract suite passed. No production code changed after the full unit run.
- Documentation links, Task Pack structure, REQ tracing, five schemas, anchored runtime trace and git diff --check passed before the report.

## Limits

Timeout does not undo a late external operation; any timed-out release requires reconciliation. This is a synthetic adapter only. Actual process ownership, descendant termination, durable release/recovery, real Codex and Electron sandbox acceptance remain unproven; no H1 or merge acceptance is claimed.
