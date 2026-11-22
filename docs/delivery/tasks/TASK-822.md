# TASK-822: Controlled Grant and Task foreign-key rebuild

## Status
APPROVED
PHASE: PHASE-007
MAX_ITERATIONS: 5
user_confirmed: true
Authority: User authorized autonomous completion of the protected Proposal and Grant/Task integration, with no production data manipulation.

## Requirement IDs
REQ-023, REQ-024, REQ-027, REQ-031, REQ-049, REQ-090, REQ-092, REQ-095, REQ-098, REQ-099

## Objective
Safely migrate the legacy Grant and Task foreign keys to the versioned Proposal authority registry, preserving all historical rows and child references. Protected Grant/Task creation stays blocked until a future trusted issuer is implemented.

## Context Pack
- docs/delivery/tasks/TASK-821.md
- docs/decisions/ADR-008-protected-task-content.md
- docs/data-model.md
- docs/operations.md
- https://sqlite.org/lang_altertable.html

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
- docs/delivery/tasks/TASK-822.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- .github/workflows/docs-gates.yml
- docs/data-model.md
- docs/security.md
- docs/operations.md
- packages/persistence/src/sqlite/database.ts
- packages/persistence/src/sqlite/migration-runner.ts
- packages/persistence/src/sqlite/migrations/032-proposal-grant-foreign-keys.sql
- packages/persistence/tests/migration-runner.test.ts
- packages/persistence/tests/proposal-authority-rebuild.test.ts
- apps/desktop/tests/main/encrypted-proposal-store.test.ts
- apps/desktop/tests/main/protected-payload-store.test.ts
- apps/desktop/tests/main/reserved-payload-service.test.ts
- apps/desktop/tests/main/protected-key-reservations.test.ts
- packages/persistence/tests/resource-lease-expiry.test.ts
- packages/persistence/tests/execution-transaction.test.ts
- apps/desktop/tests/main/queued-task-cancellation.test.ts
- apps/desktop/src/main/main.ts

## Forbidden Files
Other files, actual user databases, credentials, archives, other worktrees, main, remote operations, real Codex and Electron sandbox verification.

## Interfaces / Contracts
Migration 032 rebuilds authorization_grants and tasks using the common Proposal identity parent. Preserve existing columns, types, indexes, historical records and dependent foreign keys. A database-owned controlled rebuild temporarily disables foreign keys only before an EXCLUSIVE transaction; it compares the verified backup data version, snapshots affected rows, applies migration, verifies row fingerprints, foreign_key_check and integrity_check before commit, then restores foreign key enforcement. Reject unknown user-created indexes/triggers on rebuilt tables rather than dropping them. Persistent database rebuild requires verified backup context; direct unbacked attempts fail closed. Protected authority references cannot create or update Grants/Tasks yet.

## Data Constraints
Only disposable test databases may be opened. Never delete or rewrite an actual user database or backup. Pre-commit failure rolls back all changes and restores prior foreign-key setting. A separate post-commit WAL failure must explicitly report that the migration committed, retain the backup, and fail closed until reopening succeeds; it must not be described as rolled back. Do not alter existing legacy Proposal, Grant, Task or child data; reject orphan data and duplicate Grant-to-Task relationships without repair. Registry contains no plaintext or Proposal digest. No protected Grant, Task, native approval or dispatch is enabled.

## UI Constraints
No UI, IPC, credentials or live execution changes.

## Implementation Requirements
- Add versioned rebuild metadata to the migration runner. Detect all pending migrations before modifying schema.
- For a pending rebuild on any on-disk database require the backup context supplied by createFoundationDatabase; reject caller-owned transactions and unbacked direct migrations. Existing disposable disk test fixtures must use that same backed-up open path.
- Before an existing on-disk rebuild, open the generated backup read-only and verify integrity, schema and table content against the current database; reject changed data_version or any mismatch.
- Hash the backup file before and after the exclusive migration and refuse a missing, aliased or modified backup.
- Set foreign_keys OFF outside the transaction, acquire BEGIN EXCLUSIVE, reject changed data_version, and execute pending migrations atomically.
- Fingerprint/count Grant and Task rows before and after; preserve known explicit indexes and fail closed on unknown indexes/triggers.
- Execute foreign_key_check and integrity_check before commit; rollback on any mismatch, error, duplicate or corruption. Restore and verify original foreign_keys state.
- Rebuild parent tables with stable column names and preserve existing child references. Add one-Task-per-Grant uniqueness; reject invalid protected insert/update paths.
- Keep the current backup-on-open behavior and avoid bypassing backup or changing user files during tests.

## Test Requirements
TDD with disposable memory and disk SQLite: clean v31→32 preserves every Grant/Task/child row and foreign keys; new empty DB migration; foreign key settings restored after success/failure; interrupted/invalid/orphan/duplicate data rolls back; backup exists and remains unchanged; concurrent writer after backup blocks migration; caller-owned transaction/unbacked direct disk rebuild and tampered plan/history rejected; unknown or altered index/trigger rejected; unrelated custom schema is preserved; protected Grant/Task fail closed; legacy insertion remains functional. Inject post-commit WAL configuration failure and prove the committed state and backup are retained and reopen safely. Run lint, typecheck, build, full unit/contract and governance.

Scope amendment under the user's standing autonomous-repair authorization: the four exact desktop test files above are needed to open disposable on-disk fixtures through the mandatory backed-up migration path. They must not change application behavior or weaken assertions.

The exact lease-expiry test file is also in scope to replace an intentionally orphaned historical fixture with a complete equivalent legacy ownership graph; v32 must reject orphan data rather than bypass foreign-key validation.

Security-review amendment: SQLite VACUUM may renumber rowids in otherwise valid custom tables. The production desktop must use the public SQLite online-backup API through an asynchronous database opener, then perform the same exclusive content/FK verification. The existing synchronous opener remains fail-closed on any backup mismatch. The exact main-process file above is authorized only to switch to this opener.

Full-regression amendment: the two added test files retain their original security assertions while adapting deliberately corrupted and competing-Grant fixtures to the v32 constraints; no production permission or test assertion may be weakened.

Online backups use a newly created private staging directory and an exclusively reserved file, then retain that directory as the backup. The target directory must be under the database parent and not a link/reparse point. This reduces accidental collisions; as in ADR-008 it does not defend against a malicious process with the same Windows user authority replacing paths or changing ACLs.

Audit repair: a duplicate active transaction identifier for the immediately preceding scope amendment was corrected to task-822-write-014 after matching the original timestamp, path, resulting file SHA-256 and Result. No file action was repeated and no archived evidence was changed.

## Acceptance Criteria
No historical rows, child references or indexes are lost; pre-commit migration failure leaves original DB unchanged and enforcement restored. A post-commit WAL failure is reported distinctly and cannot be mistaken for rollback; protected Grant and Task cannot be created. No real user database is opened or modified.

## Done Definition
Record commands, actual tests and independent review; no protected execution, native authorization, real Codex or integrated acceptance is claimed.

## Risks
SQLite foreign_keys cannot be toggled inside a transaction. Incorrect parent-table rename can rewrite dependent references. This migration must use create-copy-drop-rename with backup, exclusive ownership and foreign_key_check. Unknown/custom schema blocks the rebuild rather than being silently removed.

## Output Required
Controlled rebuild runner, migration 032, tests and scoped evidence.

## Local verification evidence (2026-11-23)

- Candidate: working patch based on commit `00be716`; this is not a clean-SHA or integrated acceptance report. Windows, Node 22.19.0; all database exercises used disposable fixtures.
- `npm run lint`, `npm run typecheck`, and `npm run build`: exit 0.
- `node node_modules/vitest/vitest.mjs run --project unit --maxWorkers=1`: exit 0; 179 files, 872 passed, 9 skipped. Earlier full run had five fixture failures; fixtures were corrected without removing the assertions and the whole suite rerun.
- `node node_modules/vitest/vitest.mjs run --project contract --maxWorkers=1`: exit 0; 8 files, 49 passed, 0 skipped.
- Governance: documentation links scanned 378 Markdown files with zero issues; 169 Task Packs checked; traceability and five schemas passed; 38 governance unit tests passed; scoped runtime trace exit 0. These counts precede this evidence-only edit and must be rechecked.
- Read-only independent review found and prompted fixes for online-backup ABA concurrency and a tampered earlier pending migration. Reviewer subsequently found no new reachable Critical/Important issue, while noting that the internal SQLite API is not a sandbox for an untrusted in-process caller.
- Real Codex and Electron sandbox verification remain deferred; Windows backup ACL enforcement and integrated protected Proposal/Grant execution remain unproven. No actual user database was opened. This evidence does not authorize merge or product acceptance.
