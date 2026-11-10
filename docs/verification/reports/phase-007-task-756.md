# TASK-756 — Disposable PostgreSQL 16.4 compatibility

Conclusion: the designated PostgreSQL 16.4 integration tests passed locally.
This is compatibility evidence only, not the PostgreSQL 17.x H3 gate, a
clean-SHA candidate, H1 acceptance or release approval.

## Isolation and environment

- Windows, 2026-11-10, Node 22.19.0; PostgreSQL binaries:
  `E:/commSoft/PostgreSQL-16.4/pgsql/bin`; `initdb --version` and
  `pg_ctl --version` reported 16.4.
- New test-only cluster:
  `C:/Users/ZZY/AppData/Local/Temp/sa-pg16-7f13b8c1af1a4a81ac8250784a125267/data`.
  The server bound only 127.0.0.1 port 10940 and used synthetic data.
  No connection to `E:/commSoft/PostgreSQL-16.4/data` was made.
- Trust authentication was limited to this disposable, loopback-bound
  instance. Its retained configuration is not suitable for production and
  must not be started on a publicly reachable interface.
- Before running tests, `pg_ctl -D <test-data> status` confirmed the
  disposable data path and PID 32468. After tests, `pg_ctl -D <test-data>
  -m fast -w stop` returned exit 0. A further status check returned exit 3
  (no server running); PID 32468 and the test postmaster.pid were absent.
  The isolated cluster and log were retained; no existing database or
  user-owned data was removed.

## Test evidence

The test process used `SUPER_ASSISTANT_TEAM_DISPOSABLE=1` and a connection
string pointing only to the disposable server. Command:

`node node_modules/vitest/vitest.mjs run --project unit services/team/tests/postgres-team-repository.test.ts services/team/tests/migration.test.ts --maxWorkers=1 --reporter=dot`

Result: exit 0; 2 files, 13 passed, 0 failed, 0 skipped. This includes all
six PostgreSQL cases previously skipped in the default unit suite. The
migration test truncates and drops its test tables only within this freshly
initialized disposable cluster.

HEAD was `db83fb926269a66fea1bb3c1332c9b9c5e6526b9`; the worktree was
dirty, including team repository/schema changes. Test file SHA-256 values:

- PostgreSQL repository test: `b5e36d42ef859e796d7b5fa040ada8e220213973398342c57893812bc52d5217`.
- Migration test: `3547653feba06257c47d647a9a5d4fa73d87b95df244fff339fe19f0abdc296f`.

## Remaining limitations

PostgreSQL 17.x migration, backup/restore and production configuration remain
unverified. These isolated test results do not prove the Electron-to-Team
workflow, actual identity provider, full authorization matrix, remote CI,
clean candidate SHA or any release/merge gate. Real Codex and Electron sandbox
validation were not run.
