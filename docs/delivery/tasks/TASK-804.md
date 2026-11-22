# TASK-804: Authenticated encrypted Proposal payload foundation

## Status
APPROVED
PHASE: PHASE-007
MAX_ITERATIONS: 5
user_confirmed: true
Authority: on 2026-11-22 the user approved AES-GCM ciphertext in SQLite with keys only in Windows Credential Manager, and no plaintext or actual credentials in SQLite.

## Requirement IDs
REQ-021, REQ-023, REQ-024, REQ-025, REQ-027, REQ-090, REQ-092, REQ-094, REQ-095, REQ-098, REQ-099

## Objective
Establish an additive authenticated-encryption envelope and isolated SQLite repository for protected goal and Proposal content without wiring it to production execution before a real Windows Credential Manager broker is verified.

## Context Pack
- docs/delivery/tasks/TASK-797.md
- docs/delivery/tasks/TASK-798.md
- docs/delivery/tasks/TASK-803.md

## Must Read
- AGENTS.md
- docs/README.md
- docs/product.md
- docs/requirements.md
- docs/security.md
- docs/data-model.md
- docs/architecture.md
- docs/operations.md
- docs/decisions/README.md
- docs/verification/quality-gate.md

## Allowed Files
- docs/delivery/tasks/TASK-804.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- .github/workflows/docs-gates.yml
- docs/decisions/ADR-008-protected-task-content.md
- docs/decisions/README.md
- docs/security.md
- docs/data-model.md
- docs/architecture.md
- docs/operations.md
- apps/desktop/src/main/protected-payload-store.ts
- apps/desktop/tests/main/protected-payload-store.test.ts
- packages/persistence/src/sqlite/migration-runner.ts
- packages/persistence/src/sqlite/migrations/029-protected-payloads.sql
- packages/persistence/tests/migration-runner.test.ts

## Forbidden Files
All other application files, existing databases, archived evidence, other worktrees, main, remote operations, real Codex execution, real credential values and Electron sandbox verification.

## Interfaces / Contracts
A main-only provider creates and retrieves an opaque reference to a fresh 32-byte per-record key. Production requires Windows Credential Manager and must fail closed if unavailable; this pack uses an explicitly test-only provider and must not wire one into the desktop. AES-256-GCM uses a fresh random 96-bit nonce, a 128-bit authentication tag, and versioned associated data binding Workspace, Project, record ID, content kind, key reference and timestamp. Only fully authenticated plaintext is returned to trusted main-process code.

## Data Constraints
SQLite stores only ciphertext, nonce, tag, format version, opaque key reference and bounded nonsecret metadata. Plaintext, actual credentials and key bytes never enter SQLite, repository files or logs. Immutable records reject update, delete and INSERT OR REPLACE. Existing plaintext tables and databases are not migrated or cleaned by this pack. A lost or inaccessible key, corrupted envelope, scope mismatch, duplicate ID or malformed metadata fails closed; never silently regenerate a missing key.

## UI Constraints
No UI or renderer access is added. Existing review-only drafts remain ephemeral and cannot create Grants or Attempts.

## Implementation Requirements
Document the user-approved design and threat boundary before code. Add migration 029 without rewriting existing data. Implement bounded authenticated encryption and a repository that persists only envelope data, validates metadata before vault access and returns only authenticated content. Generate no credentials and perform no production vault writes. Test-only key provider must be declared in tests and never selected by application code.

## Test Requirements
Use red-green tests with real SQLite and Node crypto for round-trip/reopen, no plaintext/key in serialized database, ciphertext/tag/nonce/AAD tampering, wrong Workspace, missing key, duplicate/replacement, malformed data, limits and legacy migration without rewriting. Run build, lint, typecheck, full unit/contract and governance gates; independently review security.

## Acceptance Criteria
Synthetic user text survives SQLite reopen only with the original key and scope; tampering and wrong/missing key fail without exposing plaintext; serialized SQLite contains no plaintext or key. Actual Windows Credential Manager integration, legacy migration, native authorization and real execution remain explicitly unimplemented and are not counted as passed.

## Done Definition
Write exact evidence and risks; do not claim the encrypted UI flow, WinCred integration, H1 acceptance or merge readiness.

## Risks
SQLite and Credential Manager cannot share one transaction. A future broker must handle key-written/database-uncommitted orphaned keys, key loss, concurrency, backup/restore and same-user process threats without silent reset. Encryption does not prove a credential is absent from user text and does not defend a compromised Windows account or full database rollback.

## Output Required
A single Task Pack record with test evidence, an ADR, engineering fact writeback and explicit next steps.

## Local implementation evidence (2026-11-22)

- AES-256-GCM envelope and additive migration 029 are implemented in isolation; no production provider, renderer access or execution wiring is enabled.
- Red: the initial protected-payload suite failed because the module was absent; the later scope-mutation test reproduced an asynchronous scope-capture defect before its fix.
- Targeted verification after security review fixes: 37 tests passed across protected payload and migration suites, including ciphertext/tag/nonce/AAD tampering, strict identifier types, scope and key failures, key readback, immutable replacement, on-disk SQLite reopen and legacy preservation.
- Before the scope-capture fix, the full unit run reported 639 passed and 6 PostgreSQL-dependent skips; contract run reported 44 passed. These are not final-candidate complete-suite evidence after the fix.
- Governance: 360 Markdown files scanned with zero link issues; Task Pack, traceability and five schemas passed; runtime trace returned Exit 0; governance unit tests 34 passed. These results precede this evidence writeback and must be rerun before completion.
- Independent review identified and drove fixes for provider error redaction, key readback, final authorization transaction, identifier type coercion, aliased key buffers and invalid Unicode. Test-only key storage and the isolated disk fixture are not WinCred, WAL, crash-recovery or backup proof.
- Missing: actual Windows Credential Manager broker and crash recovery, end-to-end encrypted Proposal/Grant/Attempt integration, policy for actual credentials accidentally entered as text, PostgreSQL 17, final candidate CI and merge gates. Real Codex and Electron sandbox remain deferred per user direction.
