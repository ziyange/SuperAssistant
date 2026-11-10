# TASK-764 — Durable H1 lease expiry foundation

Conclusion: bounded local implementation verified, not H1/M1 acceptance.
Candidate is an uncommitted patch based on db83fb9, not a clean commit.
REQ-030/031/038/049/060/092/093/095/097/099 are addressed only for the
SQLite lease timing boundary.

New leases store canonical renewal, expiry and last-observed timestamps.
The initial TTL is 30 seconds. Renewal and write eligibility require an active
lease, matching Attempt and fencing token, and a trusted clock inside the
current window. An observed expiry and subsequent clock rollback remain
denied across restart. Invalid, absent or legacy timing is denied; expiry
does not release a lease or make the resource available for retry.

An isolated version-19 database with an ACTIVE legacy lease was migrated to
version 20. The lease retained null deadlines and remained blocking, and an
adjacent version-19 backup passed SQLite integrity checking. A new lease's
deadline survived reopen. No user application database was opened.

The initial targeted red tests showed missing expiry functionality. The first
combined regression then failed one version-18 outbox migration test because
it used the current repository to construct old schema data. Under standing
remediation authorization the exact test file was added to the Task Pack, its
structure and runtime checks reran before the edit, and the old fixture was
rewritten using version-18 SQL while preserving recovery assertions. A
separate red test proved clock rollback after an observed deadline incorrectly
restored authority; the high-water mark then made it pass after reopen.
Final targeted migration, lease, execution and outbox tests passed 87 tests.

On Windows, 2026-11-10, Node 22.19.0: production build, lint and typecheck
exited 0. Full unit tests outside the restricted process sandbox passed 466,
with 6 PostgreSQL tests skipped, across 151 files. Contract tests passed 49
across 8 files. Skipped tests are not acceptance evidence.

Before this report, ordered governance passed across 290 Markdown files,
111 Task Packs, requirement traceability, five schemas, anchored goal runtime
exit 0, 29 Python tests and git diff --check. Repeat affected checks after the
report. The separately documented Task Pack expansion is an exact-file
standing-authorization decision; the runtime output's expansion count is not
independent proof of user approval.

The clock high-water mark detects only observations that actually occur.
Time jumps without an intervening observation cannot be detected from wall
clock alone. The renewal scheduler, process ownership proof, external per-write
fencing, real Codex execution, complete authorization revalidation, deferred
Electron sandbox, clean-SHA review and remote CI remain open. A database
eligibility result alone cannot stop an Adapter that ignores the fence.
