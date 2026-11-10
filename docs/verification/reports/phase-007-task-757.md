# TASK-757 — SQLite migration concurrency fence

Conclusion: the local task-scope tests passed; M1 is not accepted. The
candidate is an uncommitted patch based on `db83fb9`, not a clean SHA.

Governance correction: the TASK-757 structural Task Pack check and explicit
scope comparison were performed after implementation, not before it. The
current Task Pack hash matches its original audited creation hash; a later
structure check passed and all 8 TASK-757 audited file writes matched its
original allowed paths. These retrospective checks do not retroactively
satisfy the missed pre-implementation gate or establish a clean global diff.

Before an existing on-disk SQLite database with pending migrations is
upgraded, the code records data_version, creates an adjacent consistent
backup, acquires an exclusive write transaction, and verifies data_version
again. An intervening commit from another SQLite connection aborts migration;
the newer original data and the earlier backup both remain. Migrations are
applied while write ownership is held. No automatic retry or restore occurs.

Windows, 2026-11-10; Node 22.19.0; npm 10.7.0:

- A red-to-green two-connection test committed a sentinel update after
  backup and before migration. Migration stopped; the original retained the
  newer value and schema 18; the backup retained the prior value.
- An initial implementation incorrectly flagged a normal migration because
  switching SQLite journal mode to WAL changed data_version on the same
  connection. Two isolated diagnostic databases established before=1,
  after_backup=1, after_wal=2, and under_lock=1 without a WAL switch.
  Journal configuration was moved after the protected migration; normal
  DELETE-journal and existing WAL migration tests then passed.
- Temporary backup, backup-failure, migration rollback and restore checks:
  7 tests passed. Diagnostic directories
  `C:/Users/ZZY/AppData/Local/Temp/sa-dataversion-dkAxY8` and
  `C:/Users/ZZY/AppData/Local/Temp/sa-dataversion-Z07Bwb` were retained.
- Root production build, lint and typecheck: exit 0. Contract suite: 8 files,
  49 passed. Full unit suite: 150 files, 429 passed, 6 skipped. The six
  PostgreSQL cases were run separately against disposable PostgreSQL 16.4
  in TASK-756, but remain skipped in this default run.
- No real application database, real Codex or Electron sandbox was opened.
  The ordered document and runtime gates must be rerun after this report.

SQLite data_version detects commits by other SQLite connections, not
uncoordinated replacement of the database file by an external actor. The
new-file creation race and concurrent old/new application ownership after
migration remain unproven. A backup made before an intervening write must not
be restored blindly. Full integrated acceptance and clean-SHA/CI evidence
remain outstanding.
