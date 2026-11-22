# TASK-821: Add versioned Proposal authority registry

## Status
APPROVED
PHASE: PHASE-007
MAX_ITERATIONS: 5
user_confirmed: true
Authority: User authorized autonomous remediation of the protected Proposal to Grant/Task integration.

## Requirement IDs
REQ-020, REQ-021, REQ-023, REQ-024, REQ-027, REQ-090, REQ-092, REQ-094, REQ-095, REQ-098, REQ-099

## Objective
Add an additive SQLite identity registry for legacy and protected Proposals, with a scoped protected payload binding. Preserve legacy Proposal, Grant and Task behavior and do not yet change their foreign keys or enable protected authorization.

## Context Pack
- docs/delivery/tasks/TASK-811.md
- docs/delivery/tasks/TASK-820.md
- docs/decisions/ADR-008-protected-task-content.md
- docs/data-model.md
- docs/security.md

## Must Read
- AGENTS.md
- docs/README.md
- docs/product.md
- docs/requirements.md
- docs/architecture.md
- docs/data-model.md
- docs/security.md
- docs/orchestration.md
- docs/verification/quality-gate.md

## Allowed Files
- docs/delivery/tasks/TASK-821.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- .github/workflows/docs-gates.yml
- docs/data-model.md
- docs/security.md
- packages/persistence/src/sqlite/migrations/031-proposal-authority-registry.sql
- packages/persistence/src/sqlite/migration-runner.ts
- packages/persistence/tests/migration-runner.test.ts
- packages/persistence/tests/proposal-authority-migration.test.ts

## Forbidden Files
Other files, production databases or credentials, archives, other worktrees, main, remote operations, real Codex and Electron sandbox verification.

## Interfaces / Contracts
Migration 031 adds proposal_authority_refs with Proposal ID, Workspace, Project, source_kind LEGACY or PROTECTED, and binding version. It backfills existing legacy Proposal IDs and adds an atomic legacy-insert trigger. An immutable protected_proposal_bindings row connects a PROTECTED identity to an exact same-scope PROPOSAL encrypted payload and LINKED key reservation. It contains no plaintext objective, criterion, full review, raw Proposal digest or executable grant. No stub is inserted into legacy proposal_versions.

## Data Constraints
No historical records are silently rewritten or removed. Reject duplicate/replacement identities, mismatched workspace/project/payload/key, non-LINKED reservations, legacy/protected collisions and binding mutation/deletion. Protected identity without a valid binding is never authorization. Existing legacy Grant/Task foreign keys remain unchanged. This registry does not authorize reads, grants or execution.

## UI Constraints
No UI or IPC change. No real Codex or sandbox validation.

## Implementation Requirements
Use an incremental migration and preserve all legacy rows and behavior. New legacy Proposal insertion must create exactly one correct LEGACY identity in the same transaction and collisions must roll back the insert. Protected binding must reference an existing matching immutable protected payload and linked reservation; require record ID equals Proposal ID. Treat any unbound PROTECTED identity as unusable. Do not store a digest in the registry or alter SHA-256 SAI semantics.

## Test Requirements
TDD real SQLite: migration of legacy records, atomic new legacy identity creation, exact protected binding, every cross-scope/key/state mismatch, INSERT OR REPLACE/UPDATE/DELETE protection, collision rollback, no plaintext/digest in registry, no Grant/Task, foreign_key_check and migration rollback on invalid existing records. Preserve backup/restore tests and repeat migration. Run focused, lint, typecheck, build, full unit/contract and governance.

## Acceptance Criteria
Legacy records remain unchanged and get matching registry identities; invalid protected bindings and replacement attempts fail atomically; no secret or raw digest is stored in new tables. No protected Grant/Task or Adapter can be enabled by this migration.

## Done Definition
Record actual verification and independent review. Future work must rebuild Grant/Task foreign keys against the common parent with migration/backup verification, provide vault provenance, native confirmation and transactional revalidation before activation.

## Risks
An orphan protected identity is not proof of a protected Proposal. Registry rows do not verify ciphertext contents, actual SHA-256, native approval, live Git baseline or process containment.

## Output Required
Migration 031, registration and SQLite regression tests with local evidence.

## Local evidence (2026-11-23; working patch on 8b05a05)
- TDD reproduced missing registry, SQLite nullable TEXT primary keys, Project Workspace and REPLACE bypasses, and legacy digest REPLACE deleting historical records. Added explicit NOT NULL, immutable scope and pre-conflict protections.
- Focused SQLite tests: 32 passed, covering version 031, preserved legacy rows, failed migration rollback, exact protected payload/reservation scope, null/FK behavior, both recursive trigger settings and backup/reopen.
- Node 22.19.0/npm 10.9.3: lint, typecheck and build passed; full unit 178 files, 832 passed and 9 skipped; contract 8 files, 49 passed.
- Independent read-only review identified and verified the null/REPLACE issues; final review found no remaining Critical/Important defect in this migration.
- Risks: invalid historical legacy scope or NULL IDs cause atomic migration failure and require backup-based human investigation. Registry bindings do not verify ciphertext, Workspace owner, user approval or authorization. Grant/Task foreign keys are unchanged; protected execution remains disabled.
- Working-patch results are not clean-SHA CI, H1 integrated acceptance or merge approval. No production data, real Codex, real credential or Electron sandbox was used.
