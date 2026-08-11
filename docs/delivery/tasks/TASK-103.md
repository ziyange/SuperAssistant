# TASK-103: Establish foundation domain and SQLite persistence

## Status

APPROVED

PHASE: PHASE-001

MAX_ITERATIONS: 5

user_confirmed: true

## Requirement IDs

REQ-001, REQ-010, REQ-014, REQ-015, REQ-017, REQ-019, REQ-092, REQ-095, REQ-097, REQ-099

## Objective

Implement the authoritative foundation domain types, deterministic state transitions, SQLite connection/migration discipline, and repositories for Workspace, Project, Agent, Function, and reserved version references.

## Context Pack

- `docs/data-model.md`
- `docs/architecture.md`
- `docs/decisions/ADR-003-authoritative-state-and-delivery.md`

## Must Read

- `AGENTS.md`
- `docs/requirements.md`
- `docs/data-model.md`
- `docs/security.md`
- `docs/operations.md`
- `docs/decisions/ADR-003-authoritative-state-and-delivery.md`

## Allowed Files

- packages/domain/src/foundation.ts
- packages/domain/src/agent-state.ts
- packages/domain/src/identifiers.ts
- packages/domain/src/ports/foundation-repository.ts
- packages/domain/src/index.ts
- packages/domain/tests/foundation.test.ts
- packages/domain/tests/agent-state.test.ts
- packages/persistence/src/sqlite/database.ts
- packages/persistence/src/sqlite/migration-runner.ts
- packages/persistence/src/sqlite/migrations/001-foundation.sql
- packages/persistence/src/repositories/foundation-repository.ts
- packages/persistence/src/index.ts
- packages/persistence/tests/migration-runner.test.ts
- packages/persistence/tests/foundation-repository.test.ts
- docs/data-model.md
- docs/operations.md
- docs/verification/reports/phase-001-task-103.md

## Forbidden Files

- Any file not explicitly listed in Allowed Files.
- Renderer components, IPC handlers, credential values, Codex protocol code, Proposal/Task execution tables, and destructive migration shortcuts.

## Interfaces / Contracts

Implement repository ports in the domain package and SQLite adapters in persistence. Domain types cannot import SQLite. State transitions are pure functions. Reserve immutable Agent, Function, Template, protocol, and snapshot version references without implementing Template behavior.

## Data Constraints

Use stable opaque identifiers, UTC timestamps, foreign keys, uniqueness, schema versioning, and transactional migrations. Store opaque credential references only. Connection and Availability are orthogonal; Connection errors win display precedence. Migrations have tested upgrade and failure rollback behavior.

## UI Constraints

No UI behavior is implemented. Repositories expose read models sufficient for later Agent and Project projections without leaking SQL rows or credential references.

## Implementation Requirements

- Encode every declared foundation state transition and rejection.
- Enable SQLite foreign keys and safe transaction settings.
- Make migrations repeatable on a fresh database and atomic on failure.
- Preserve future H2 Template/version compatibility fields.

## Test Requirements

- Table-test valid and invalid Workspace, Project, Connection, and Availability transitions.
- Test unique canonical Project identity and stable version references at repository level.
- Run fresh migration, repeated startup, simulated migration failure, and reopen tests.
- Run focused unit tests, lint, typecheck, and build.

## Acceptance Criteria

- SQLite is the only authoritative persistence implementation and survives process reopen.
- Invalid state combinations and transitions are rejected deterministically.
- No secret value appears in database fixtures or logs.
- Migration failure leaves the prior schema usable and version unchanged.

## Done Definition

Foundation domain and persistence tests pass, schemas match data-model facts, no execution model was prematurely implemented, and verification evidence is recorded.

## Risks

`SECURITY_PERMISSION 0.600` is active and confirmed. Credential references, database paths, and logs are sensitive boundaries. `SCHEMA_MIGRATION 0.471` is below activation but controlled through transactional migration and reopen tests.

## Output Required

Return changed files, schema version and table inventory, transition test matrix, migration/reopen output, secret scan result, and the phase report path.
