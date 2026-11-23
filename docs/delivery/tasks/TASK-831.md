# TASK-831: Reject conflicting persisted DSH events

## Status
COMPLETED
PHASE: PHASE-007
MAX_ITERATIONS: 4
user_confirmed: true
Authority: standing user authorization to resolve merge blockers and preserve at-least-once idempotency without weakening DSH capability policy.

## Requirement IDs
REQ-027, REQ-036, REQ-045, REQ-049, REQ-077, REQ-078, REQ-090, REQ-098

## Objective
Distinguish an exact DSH journal replay from conflicting or invalid persisted evidence, preserving the original row and failing closed on conflict.

## Context Pack
- docs/delivery/tasks/TASK-830.md
- docs/adapters/dsh.md
- docs/data-model.md
- docs/api/sai.md
- docs/orchestration.md

## Must Read
- AGENTS.md
- docs/README.md
- docs/product.md
- docs/requirements.md
- docs/architecture.md
- docs/data-model.md
- docs/security.md
- docs/operations.md
- docs/verification/quality-gate.md

## Allowed Files
- docs/delivery/tasks/TASK-831.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- docs/adapters/dsh.md
- packages/persistence/src/dsh-attempt-journal-repository.ts
- packages/persistence/tests/dsh-attempt-journal-repository.test.ts

## Forbidden Files
Other paths, schema or migration changes, archive evidence, DSH source checkout, capability broker or policy implementations, production routing, user projects and credentials, other worktrees, real Codex, Electron sandbox verification, external operations and merge.

## Interfaces / Contracts
Retain the boolean `append` API for exact inserts and identical replays. Validate identifiers, positive safe-integer sequence, bounded JSON object evidence and canonical UTC timestamp. Insert using an exact primary-key conflict clause inside a SQLite transaction; on conflict compare stored event type, raw evidence JSON and creation timestamp exactly. Identical replay returns false; changed content or timestamp throws `DSH_JOURNAL_SEQUENCE_CONFLICT`; missing prior evidence throws `DSH_JOURNAL_INDETERMINATE`. Invalid input throws `DSH_JOURNAL_INPUT_INVALID`. No error includes evidence content. Exact-byte comparison is deliberately conservative and is not semantic JSON canonicalization.

## Data Constraints
Use only synthetic evidence and temporary SQLite databases. Never print event evidence or credentials in error text. The repository's JSON validation does not prove evidence is secret-free; production collection remains disabled pending a complete redaction boundary.

## UI Constraints
No UI, renderer, IPC or production composition change. DSH remains a disabled compatibility probe.

## Implementation Requirements
First reproduce that changed content and invalid sequence return false instead of reporting an error. Replace broad `INSERT OR IGNORE` with targeted conflict handling and exact row comparison in a single transaction. Preserve the first row and don't modify any Attempt or Lease. Do not claim that transient errors persist an AMBIGUOUS flag: migration 017 contains no such durable evidence and no immutable-row triggers. DSH recovery must remain RECONCILING until a separate durable design is implemented.

## Test Requirements
Observe failing conflict and invalid-input regressions. Test exact replay, changed type/evidence/timestamp, invalid IDs and sequences, malformed or non-object JSON, noncanonical timestamp, separate Attempts and ordered results. Use a temporary file and independent SQLite connections for a duplicate/conflict check. Run affected tests, lint, typecheck, build, full unit and contract, independent review and governance.

## Acceptance Criteria
An exact replay returns false; a differing same-sequence event raises a stable conflict and leaves the original row unchanged. Invalid input cannot be silently ignored or written. Separate Attempt identities remain independent. No production DSH or capability behavior is enabled or disabled.

## Done Definition
Commit scoped code, tests and operational facts with exact results and explicitly retain the missing durable ambiguity, immutable database rows and secret-redaction work as blockers.

## Risks
Database-level conflict evidence and gap ambiguity are not retained across restart. Exact string comparison can conservatively flag equivalent JSON encodings as conflicts. Free-text secrets cannot be reliably detected by JSON parsing.

## Output Required
Validated transactional DSH journal append, real SQLite regression tests and accurate engineering limitations.

## Work in progress
Two initial regressions reproduced silent acceptance of conflicting same-sequence evidence and invalid sequence zero. The repository now validates bounded object JSON and canonical metadata, rejects Proxy/accessor inputs, and compares exact stored values under an IMMEDIATE transaction with a targeted primary-key conflict clause. Twenty targeted tests passed, including two independent SQLite connections tested sequentially; this is not a concurrent stress test. Independent static review found no substantiated Critical or Important issue and did not run tests. Lint, typecheck and build passed. Full unit and contract checks remain pending. This call-time rejection does not persist conflict/gap history, impose database-level immutable-row constraints, prove evidence free of secrets, or enable DSH.

The final Windows host full-unit run passed 1,098 tests with nine skipped across 182 files; the complete fake-service contract suite passed 50/50. Skips are not passes. This result covers the scoped repository behavior only and does not constitute authenticated durable DSH recovery or merge acceptance.
