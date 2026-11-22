# TASK-805: Durable protected-key reservations

## Status
APPROVED
PHASE: PHASE-007
MAX_ITERATIONS: 5
user_confirmed: true
Authority: User authorized continued independent development and approved encrypted goal/Proposal content with WinCred-held keys.

## Requirement IDs
REQ-021, REQ-023, REQ-027, REQ-090, REQ-092, REQ-094, REQ-095, REQ-098, REQ-099

## Objective
Implement a durable, fenced SQLite reservation journal for protected keys, allowing safe observation and conservative reconciliation of key-write and payload-commit interruptions. This is a foundation, not production WinCred integration.

## Context Pack
- docs/delivery/tasks/TASK-804.md
- docs/decisions/ADR-008-protected-task-content.md

## Must Read
- AGENTS.md
- docs/README.md
- docs/product.md
- docs/requirements.md
- docs/security.md
- docs/data-model.md
- docs/operations.md
- docs/architecture.md
- docs/verification/quality-gate.md

## Allowed Files
- docs/delivery/tasks/TASK-805.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- .github/workflows/docs-gates.yml
- docs/security.md
- docs/data-model.md
- docs/operations.md
- packages/persistence/src/sqlite/migration-runner.ts
- packages/persistence/src/sqlite/migrations/030-protected-key-reservations.sql
- packages/persistence/tests/migration-runner.test.ts
- apps/desktop/src/main/protected-key-reservations.ts
- apps/desktop/tests/main/protected-key-reservations.test.ts

## Forbidden Files
All other application files, existing databases, archived evidence, other worktrees, main, remote operations, actual credentials and real WinCred writes, real Codex execution and Electron sandbox verification.

## Interfaces / Contracts
The journal uses a random opaque key reference and per-reservation owner token. Creating a reservation is atomic before an external key write. Only the matching owner can confirm storage or payload linkage; ambiguous operations remain UNCERTAIN without automatic retries. Recovery is read-only and distinguishes an exact durable payload binding from unlinked or conflicting records.

## Data Constraints
Persist only opaque references, owner-token hashes, identity, states and timestamps. Never persist keys, plaintext, credentials or owner-token values. Existing encrypted rows are not changed. No journal operation deletes or overwrites credentials. References and record identities are validated before database access.

## UI Constraints
No UI, renderer or user-input integration. No new executable function, Grant or Attempt.

## Implementation Requirements
Add migration 030 and a main-only repository. Reserve atomically with SQLite uniqueness, check active local Workspace/Project authority in the transaction, issue fresh identifiers and token, and store only a SHA-256 token hash. Compare owner tokens in constant time. Transitions fail closed on stale token, wrong scope and illegal state; external-write uncertainty cannot silently become safe-to-retry. Reconciliation must not modify a vault or create keys. Unlinked reservations remain durable for future explicit broker recovery.

## Test Requirements
Use TDD and real temporary SQLite to test atomic reservation, database reopen, duplicate/concurrent reservation, token mismatch, transitions, crash-equivalent intermediate states, active authority revocation and exact-payload versus conflicting-payload reconciliation. Test the migration from version 029 without modifying existing records. Run lint, typecheck, build, affected and complete tests plus governance gates.

## Acceptance Criteria
Competing reservations cannot authorize multiple writes for the same record; stale owners cannot advance state; restarts retain uncertainty; reconciliation never performs side effects in the vault or allows implicit retry. A linked result requires an exact matching protected payload.

## Done Definition
Record actual tests and limitations in this Task Pack. Do not claim WinCred implementation, production Proposal integration, H1 acceptance or merge readiness.

## Risks
SQLite and Credential Manager cannot share one transaction. A reservation cannot guarantee isolation against a malicious same-user process or a vault implementation that overwrites a name. Orphaned keys require a later independently verified, explicitly scoped recovery protocol; automatic deletion is prohibited.

## Output Required
Journal implementation, migration, focused tests and a single Task Pack evidence record.

## Local evidence and limitations (2026-11-22)

- The initial focused suite failed because the journal module did not exist. After implementation, 22 focused tests passed, including two concurrent worker threads using independent SQLite connections; this is not separate-process evidence.
- Migration 030 preserves existing encrypted payloads and does not fabricate reservations. Reopening an interrupted reservation preserves UNCERTAIN, blocks duplicate reservation and refuses implicit storage confirmation.
- The journal never receives or generates key material and never accesses a vault. WinCred integration, key-write recovery, orphan cleanup, complete Proposal integration, actual-credential input separation and independent review remain unverified. No product execution was enabled.
- After the concurrency test was added, lint and typecheck exited 0. Production build exited 0 for the same implementation before that test-only edit. Full unit: 170 files passed, 659 tests passed, 6 PostgreSQL-dependent tests skipped. Contract: 8 files and 44 tests passed. The skips and unrun remote CI are not acceptance.
- Ruling: the race fixture uses two worker threads with separate SQLite connections, not separate operating-system processes. Cross-process behavior and vault coordination remain unverified.
