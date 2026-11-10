# TASK-752 — Atomic execution revalidation

Conclusion: local task-scope checks passed; M1 is not accepted. Evidence
covers an uncommitted patch based on `db83fb9`, not a clean candidate SHA.
REQ-025–027, REQ-031, REQ-090–091 and REQ-098 are covered only as described.

## Changes and verification

- New Attempt creation re-reads Project, Agent and Function in the same
  SQLite transaction before Grant consumption. Project status and snapshot,
  Workspace ownership relationships, Agent version/connection/availability,
  Function identity/version/lifecycle must match. Failure rolls back.
- Seven red-to-green SQLite cases changed those fields and confirmed the
  Grant stays ISSUED and Task, Attempt, Lease and Outbox stay empty.
- Idempotent replay after a Project change returns the original receipt
  without creating a second Attempt or Outbox record.
- A red-to-green test exposed that Attempt creation used caller-supplied time;
  it now records the same trusted clock as the Task and Outbox.
- Windows, 2026-11-10; Node 22.19.0; npm 10.7.0. Root build, lint and
  typecheck exit 0; contract suite 8 files / 49 passed; full unit suite
  150 files / 408 passed / 6 skipped. Skips are not acceptance evidence.
- Goal-mode runtime trace before this report exit 0; final ordered governance
  must be rerun after writing this report.

## Remaining gaps

No authoritative capability-version or Git-baseline comparison was added:
the current database schema cannot prove those facts. Dispatch-time
revalidation and Proposal/Grant action scope and digest integrity still need
independent verification. No real Codex execution, Electron sandbox, system
acceptance, clean-SHA evidence or external CI was run.
