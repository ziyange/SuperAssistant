# PHASE-007 TASK-714 verification report

- Decision: `PASS`
- Worktree: `E:\Programs\Super Assistant\.worktrees\TASK-714-revalidation`
- Branch: `codex/phase-007-enterprise`
- Date: 2026-08-25
- Scope expansion: PostgreSQL governed-record tables and their disposable
  repository fixture were explicitly approved on 2026-08-24.

## Delivered behavior

- A Workspace-scoped inventory includes `ATTEMPT`, `GRANT`, `LEGAL_HOLD`,
  `ROLLBACK`, `EVIDENCE`, `AUDIT`, and `RETENTION` records and produces a
  SHA-256 manifest digest.
- Audit export is authorized before repository access and detects manifest
  tampering.
- Retention defaults to preserve. A destructive deletion requires a matching
  actor/Workspace/record/policy/expiry one-time Grant and a prior policy dry
  run. Grant consumption, legal-hold recheck, deletion, and append-only audit
  record occur in one PostgreSQL transaction.
- The retention API returns only safe denial codes; it never accepts an
  unbound authorization reference as authority.

## Local verification evidence

| Gate | Command / evidence | Result |
|---|---|---|
| Focused unit and API contract | TASK-714 service, API and repository suites | PASS: 6 passed; 3 environment-gated PostgreSQL tests skipped without a database URL |
| PostgreSQL retention integration | Disposable `sa_task714_retention` on local PostgreSQL 16.4 | PASS: 5 passed; held record preserved, Grant replay rejected, and race-to-hold rolled back Grant consumption; database dropped |
| Backup/restore rehearsal | Disposable PostgreSQL 16.4 `pg_dump -Fc` + `pg_restore` | PASS: restored `7:7` governed records/classes and one active legal hold; source, restore database and temporary backup removed |
| Lint | `npm run lint` | PASS |
| Typecheck | `npm run typecheck` | PASS |
| Build | `npm run build` | PASS |
| Contract | `npm run test:contract` | PASS: 8 files / 35 tests |
| E2E | `npm run test:e2e` | PASS: 7 Playwright tests |
| Full deterministic unit | Node 22 single-worker Vitest suite after TASK-719 | PASS; the DSH Loader Guard deadline is finite and the full suite passes twice |

## Gate recovery

The earlier DSH Loader full-suite timeout was outside this Pack's allowlist.
[TASK-719](phase-007-task-719.md) supplied a scoped test-only, finite deadline
and two Node 22 full-suite passes; no retention or DSH production behavior was
changed as part of this recovery.

## Known limits

- PostgreSQL 16.4 is local compatibility and rehearsal evidence only. The
  PostgreSQL 17 deployment, authority-loss and H3 acceptance work remain
  assigned to TASK-717.
- Remote CI remains planned; no merge, push, release, or worktree deletion was
  performed.
