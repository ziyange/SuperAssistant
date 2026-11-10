# TASK-762 — Fence claims for uncertain Attempts

Conclusion: bounded local fix verified; not H1/M1 acceptance. Candidate is
an uncommitted patch based on db83fb9, not a clean commit.
REQ-030/038/049/092/093/097/099 are addressed only at claim time.

Before the change, two SQLite integration cases demonstrated that a pending
start for an UNKNOWN or RECONCILING Attempt was dispatched to a fake adapter.
The conditional claim now tests the persisted Attempt state in the same SQL
update; a pending row for either state is quarantined without changing the
Attempt or returning a command. The targeted SQLite and dispatcher suites
passed 21 tests, including the existing interleaved claimant and token tests.

On Windows, 2026-11-10, Node 22.19.0: build, lint and typecheck exited 0.
Full unit tests outside the restricted process sandbox passed 439 tests with
6 PostgreSQL tests skipped across 150 files. Contract tests passed 49 across
8 files. Skipped tests are not acceptance evidence.

Before this report, ordered governance passed: 286 Markdown files, 109 Task
Packs, traceability, five schemas, anchored goal runtime exit 0, 29 Python
tests and git diff --check. Repeat affected checks after writing this report.

This claim-time predicate does not prevent a later Attempt state change before
an external call. It is not a full lifecycle state allowlist and does not
revalidate a Grant, baseline, capability, Lease or fencing token. Real
dispatch must remain disabled until those and Adapter reconciliation are
independently implemented and verified. Real Codex, deferred Electron sandbox,
clean-SHA and remote CI gates remain open.
