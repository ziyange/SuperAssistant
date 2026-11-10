# TASK-765 — Isolated lease renewal supervisor

Conclusion: bounded local component verified, not H1/M1 acceptance. The
candidate is an uncommitted patch based on db83fb9, not a clean commit.
REQ-030/031/038/049/060/092/095/097/099 are addressed only at the isolated
renewal boundary.

An explicitly started supervisor checks injected ownership and the SQLite
lease, renews every 10 seconds, and stops after a failed or throwing check,
expiration or renewal failure. It emits at most one loss notification;
synchronous errors and asynchronous rejections set notificationFailed.
Stop and loss do not release, retry or reassign a Lease. The supervisor
copies the lease identity and cannot restart after stop or loss.

Real in-memory SQLite and fake-clock tests exercise renewal, a delayed timer,
ownership loss, stale identity, callback failure and stop. The initial RED
test showed the component was absent. Additional RED tests exposed renewal
after a reentrant stop, reentrant start and a missed asynchronous notification
failure; these were fixed and rerun. Final targeted lease and supervisor
tests passed 17 tests.

On Windows, 2026-11-10, Node 22.19.0: production build and typecheck exited
0. Lint initially failed for missing timer globals and then for a named
type-only callback parameter; both fixes were retained and final lint exited
0. Full unit tests outside the restricted process sandbox passed 477 with 6
PostgreSQL tests skipped, across 152 files; the full unit suite was rerun
after the last test-only lint comment. Contract tests passed 49 across 8
files. Skips are not acceptance evidence.

Before this report, ordered governance passed across 292 Markdown files,
112 Task Packs, requirement traceability, five schemas, anchored goal runtime
exit 0, 29 Python tests and git diff --check. Repeat affected checks after
this report.

This component is not wired to production startup or a real Adapter. The
owner-liveness predicate and loss callback are injected and do not prove
actual worker termination or durable recovery. A pending asynchronous
notification is not proof of delivery. Per-write Adapter fencing, full
authorization revalidation, real Codex, deferred Electron sandbox, clean-SHA
review and remote CI remain open.
