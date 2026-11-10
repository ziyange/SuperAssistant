# TASK-753 — Proposal and Grant binding

Conclusion: local task-scope checks passed; M1 is not accepted. Evidence is
for an uncommitted patch based on `db83fb9`, not a clean candidate SHA.
REQ-020–022, REQ-025–027, REQ-090–091 and REQ-098 are covered only for
the database boundaries described here.

## Evidence

- Grant issuance rejects read-only, empty and unknown Proposal actions.
- New Attempt creation recomputes the stored Proposal digest, validates
  side-effecting actions, requires exact Proposal/Grant action equality and
  requires matching Proposal/Grant expiry. Failures occur inside the
  transaction before Grant consumption or Task/Attempt/Lease/Outbox writes.
- Eight red tests reproduced invalid Grant issuance, mismatched actions and
  matching forged digests; an additional red test reproduced expiry extension.
  Focused persistence tests: 3 files, 42 passed.
- The first complete unit run failed one Outbox test because its fixture used
  a fake digest and empty action list. The fixture was changed to a genuine
  Proposal digest and COMMAND scope; the original Outbox assertions were
  retained. The subsequent full unit run passed 150 files, 417 tests, with
  6 skipped. Skips do not count as acceptance.
- Windows, 2026-11-10; Node 22.19.0; npm 10.7.0. Root production build,
  lint and typecheck exit 0. Contract suite: 8 files, 49 passed.
- Goal-mode runtime and ordered document gates must be rerun after this report.

## Remaining gates

No executor-level enforcement of specific shell, file or network operations
was established. Authoritative capability-version and current Git-baseline
checks, atomic dispatch and reconciliation, real Codex execution, Electron
sandbox verification, clean candidate SHA and remote CI remain unproven.
