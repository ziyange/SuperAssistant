# TASK-755 — Outbox claim fencing and migration backup

Conclusion: local task-scope checks passed, not M1 acceptance. The candidate
is an uncommitted patch based on `db83fb9`, not a clean candidate SHA.
REQ-027, REQ-030, REQ-032, REQ-038, REQ-049, REQ-090–092, REQ-096,
REQ-098–099 are addressed only within the boundaries below.

## Implemented and tested

- Migration 019 adds a nullable unique claim token. Claiming returns a token
  only after the conditional update succeeds. Acknowledgement and
  uncertain-result transitions require the current token; stale tokens fail.
- A failed fake dispatch marks the claim RECONCILING and its nonterminal
  Attempt UNKNOWN. The explicit interrupted-claim recovery operation does
  the same without requeueing; its caller must first establish that previous
  worker ownership ended. No production startup or dispatcher was wired.
- An existing on-disk test database with pending migrations receives a
  unique adjacent `.pre-migration-<uuid>.sqlite` snapshot before migration.
  Test-injected backup failure prevents migration. An intentionally failed
  upgrade preserved version 18 and its retained backup was copied to a
  separate test file and read successfully.
- Legacy in-flight rows with no token are moved to reconciliation by the
  explicit recovery operation; stale-token and duplicate-claim tests pass.
- The first full unit run failed the Decision Outbox test: its legacy
  eight-value insertion did not name columns after migration 019. Its
  existing test was retained, the exact Decision repository file was added
  to the Task Pack and its insertion changed to explicit columns. The
  affected four test files then passed 21 tests.
- Windows, 2026-11-10, Node 22.19.0, npm 10.7.0. Root build, lint,
  typecheck exit 0; contract suite 8 files / 49 passed; complete unit suite
  150 files / 427 passed / 6 skipped. Skips are not acceptance evidence.
- The first intentional backup-failure red test left a temporary test-only
  folder `C:/Users/ZZY/AppData/Local/Temp/sa-migration-zSd6gS` because the
  old implementation left the database handle open. It was not deleted.
- Goal-mode runtime and ordered governance must be rerun after this report.
- A read-only comparison of the final recorded digest for each of the 16
  task-audited paths with its working file found zero mismatches before this
  report update. This does not classify unrelated pre-existing dirty files.

## Remaining blockers

No real application database was opened or migrated. Concurrent old/new app
instances and backup-to-migration coordination are not proven; enforce
single-writer ownership before production migration. Backup restore has been
tested only on temporary databases. The real SQLite-to-dispatcher payload
adapter, actual worker ownership proof, durable upstream reconciliation,
capability/baseline enforcement, real Codex, Electron sandbox, clean-SHA
evidence and remote CI remain unverified. Do not enable real dispatch or
claim H1/M1 acceptance from these tests.
