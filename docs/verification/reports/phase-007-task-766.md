# TASK-766 — Exact renderer navigation

Conclusion: bounded local security correction verified, not M1 acceptance.
Candidate is an uncommitted patch based on db83fb9. REQ-090/093/094/095/099
are addressed only for the navigation policy described here.

The prior file policy returned true for another local file URL while the IPC
sender check returned false. A red test reproduced the navigation failure.
The file policy now allows only the exact bundled renderer URL; both main
window navigation handlers use that same URL rather than a generic file origin
or an environment-controlled origin. Synthetic other-path, encoded-path,
host, query, fragment and external URL cases are rejected. IPC sender checks
remain separate and unchanged.

On Windows, 2026-11-10, Node 22.19.0, focused window and IPC tests passed
16; production build, lint and typecheck exited 0; full unit tests passed
478 with 6 PostgreSQL tests skipped across 152 files; contracts passed 49
across 8 files. The skipped cases are not acceptance evidence. Prior to
this change, the same candidate ran 483 unit tests with a disposable local
PostgreSQL 16.4 server and zero skips; that run predates this correction.

Before this report, ordered governance passed for 294 Markdown files, 113
Task Packs, traceability, five schemas, anchored goal runtime exit 0,
29 Python tests and git diff --check. Repeat affected checks after the report.
The user confirmed no other session used the previously held audit lock; the
identified idle holder was stopped only after a runtime check found no pending
transactions. No lock file or user data was manually removed.

Real Electron sandbox/preload integration remains deferred and unverified.
This change does not prove absence of all renderer vulnerabilities or accept
H1/M1. The candidate still requires clean-SHA review and remote application CI.
