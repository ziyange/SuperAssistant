# TASK-751 — Fail-closed preflight boundary

Conclusion: local task-scope tests passed, not H1/M1 acceptance. The candidate
is an uncommitted working patch based on `db83fb9`, not a clean commit.
REQ-020, REQ-021, REQ-025–027, REQ-090–091 and REQ-098 are addressed only
for the specific domain and IPC boundaries below.

## Changes and evidence

- Unknown, non-string, empty and sparse action arrays are rejected by both
  domain classification and the IPC schema. Only explicitly listed actions
  may be classified; known read-only and side-effecting cases retain their
  expected results.
- Invalid/noncanonical calendar timestamps, an unissued approved grant and
  changed grant expiry cannot produce READY. Internal timestamps use the
  canonical UTC millisecond ISO-8601 representation. Snapshot fields are
  still not proof of identity, permission or dispatch authorization.
- Red tests exposed the previous unknown-action, invalid-time, changed-expiry
  and grant-status failures. One initial parameterized action test had the
  wrong nesting and passed for the wrong reason; it was corrected and then
  observed failing before the fix.
- Windows, 2026-11-10, Node 22.19.0, npm 10.7.0. Root build, lint,
  typecheck: exit 0. Contract suite: 8 files, 49 passed. Full unit suite,
  one worker: 150 files, 400 passed, 6 skipped. Skips are not acceptance
  evidence.
- Anchored goal runtime trace returned exit 0 before this report. The
  `task-751-security-002` documentation patch first failed to match its
  header and left PENDING; the existing file hash was verified unchanged
  against its last committed audit entry, then the same transaction was
  retried and completed. A subsequent trace returned exit 0.
- The previous lock holder remained the sole observed writer after its
  configured lease elapsed; it was released and a fresh lock acquired before
  subsequent work. A full independent Git file-boundary audit remains part of
  the merge gate.

## Limitations

The desktop proposal preflight is not wired to trusted persisted state or
exposed for execution. The existing snapshot contract does not identify the
grant and cannot independently prove that a grant belongs to the correct
principal, Proposal or Attempt. A future dispatcher must load and validate
the actual records and trusted clock atomically. No real Codex, Electron
sandbox, integrated acceptance or external CI was run.
