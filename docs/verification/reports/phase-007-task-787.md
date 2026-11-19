# TASK-787 verification — durable local startup quarantine

Baseline: `78877ea`. Scope: [TASK-787](../../delivery/tasks/TASK-787.md).
This is production desktop startup quarantine, not live outcome reconciliation.

The new fixture serializes and reopens real SQLite records. The first run
exposed fixture insert-column and claim-token uniqueness errors. These were
corrected before the behavior test; the insert patch was reconciled under its
original pending audit intent. The next red run identified the missing
startup operation. The final run verifies unique active local ownership,
held and ambiguous Workspace denial, abandoned and acknowledged in-flight
work, old claim-token invalidation, pending-safe and terminal preservation,
foreign isolation, retained Leases and Grants, and idempotent restart.

Desktop now requests the instance lock before opening the database and calls
the transaction before it installs IPC or shows a window. It does not
contact an Adapter, infer a terminal outcome, redispatch or release a Lease.
The SQLite fixture exercises the real recovery transaction; it does not
start Electron or establish that an upstream process was terminated.

Focused result: 41 tests passed across two files. Final local build, lint, typecheck and full Vitest:
passed: 543 unit tests, six PostgreSQL-dependent skips, and 49 contract tests. Ordered governance preflight scanned 337 documents and 134 Task Packs,
verified traceability and five schemas, Plan runtime Exit 0, 34 Python tests
and exact file scope. Repeat after this report.

No trusted executable Function or immutable full Proposal confirmation path
is enabled. App Server outcome and lease reconciliation remain open,
as do H1/M1 and merge acceptance. Real Codex and Electron sandbox validation
remain deferred; no user Project, main ref or preserved worktree was modified.
