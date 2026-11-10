# TASK-763 — Lifecycle and Decision evidence for queue claims

Conclusion: bounded local implementation verified, not H1/M1 acceptance.
Candidate is an uncommitted patch based on db83fb9, not a clean commit.
REQ-030/038/040/043/049/092/093/097/099 are addressed only at the internal
claim and fake-dispatch boundary.

Start claims now require DISPATCH_PENDING; resume claims require WAITING_USER
or WAITING_INPUT. Ineligible pending commands are quarantined without changing
their Attempt. A resume also requires a resolved Decision matching the
Attempt WorkItem, Task, Workspace, Project, resolution ID and idempotency key.
Uncertainty and interrupted-claim recovery preserve NOT_STARTED as terminal.

Before the implementation, the targeted test showed 14 failures: start was
sent from nine inappropriate states, four Decision-evidence variants were
sent, and recovery changed NOT_STARTED to UNKNOWN. Tests were subsequently
strengthened so the negative Decision fixtures use a matching key unless key
mismatch is the scenario; five additional resume-state cases were added.
The final targeted SQLite, dispatcher and Decision suites passed 46 tests.
The first failure evidence did not independently isolate each strengthened
condition; it should not be read as separate mutation coverage.

Windows, 2026-11-10, Node 22.19.0: build, lint and typecheck exited 0.
Full unit suite outside the restricted process sandbox passed 460 tests,
with 6 PostgreSQL tests skipped across 150 files; contract suite passed 49
across 8 files. Skips are not acceptance evidence.

Before this report, ordered governance passed: 288 Markdown files, 110 Task
Packs, requirement tracking, five schemas, anchored goal runtime exit 0,
29 Python tests and git diff --check. Repeat affected checks after the report.

These checks do not prevent state, Grant, snapshot or Lease changes after a
claim and before an external effect. They do not implement full SAI, real
Adapter reconciliation or production dispatch. Real Codex, deferred Electron
sandbox, clean-SHA review, remote CI and M1 merge gates remain open.
