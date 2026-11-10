# TASK-729: Persist H1 onboarding state across restart

## Status
APPROVED
PHASE: PHASE-007
MAX_ITERATIONS: 4
user_confirmed: true
Authorization: user-approved continuous M1 remediation and autonomous ordinary decisions.

## Requirement IDs
REQ-002, REQ-005, REQ-092, REQ-095, REQ-097, REQ-099

## Objective
Replace the desktop main process's volatile onboarding flag with a durable SQLite-backed port so the existing onboarding IPC survives application restart.

## Context Pack
- docs/delivery/phase-007-integration-recovery.md
- docs/verification/reports/phase-007-task-721.md

## Must Read
- AGENTS.md
- docs/README.md
- docs/requirements.md
- docs/data-model.md
- docs/architecture.md
- docs/security.md
- docs/verification/quality-gate.md
- packages/persistence/src/sqlite/migration-runner.ts
- apps/desktop/src/main/ipc-router.ts

## Allowed Files
- docs/delivery/tasks/TASK-729.md
- docs/verification/reports/phase-007-task-729.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- docs/data-model.md
- packages/persistence/src/sqlite/migrations/018-onboarding.sql
- packages/persistence/src/sqlite/migration-runner.ts
- packages/persistence/src/repositories/onboarding-repository.ts
- packages/persistence/src/index.ts
- packages/persistence/tests/onboarding-repository.test.ts
- packages/persistence/tests/migration-runner.test.ts
- apps/desktop/src/main/main.ts
- apps/desktop/tests/main/ipc-router.test.ts

## Forbidden Files
Do not change existing migrations, sandbox settings, other UI or execution behavior, archived evidence, package locks, external projects or user worktrees.

## Interfaces / Contracts
The existing `OnboardingPort` and `onboarding:get`/`onboarding:set` IPC payloads remain unchanged. The new SQLite table has one fixed row and a boolean integer constrained to 0 or 1; absent state means incomplete. All writes occur in the main process through the existing database.

## Data Constraints
Migration 018 is additive and transactional, without modifying existing rows. No secrets or user-entered content are stored. Preserve existing databases and test only temporary or in-memory databases.

## UI Constraints
No visual layout or flow changes. Existing IPC response shape remains stable.

## Implementation Requirements
Record the storage contract before implementation, add migration 018 and a small SQLite repository implementing the existing async port shape, and wire it into desktop main after database initialization. Do not claim restart persistence without reopening a real temporary SQLite database.

## Test Requirements
Start with a failing migration/reopen test. Verify initial false, persisted true and false, reopen and idempotent migration, IPC response shape, invalid database values, and existing migration rollback. Run targeted Vitest, typecheck, lint, task pack and runtime checks.

## Acceptance Criteria
Onboarding completion remains correct after the database is closed and reopened; default state is false; invalid stored values are rejected; existing IPC payloads remain unchanged and existing migrations remain intact.

## Done Definition
Tests, lint and applicable governance pass with evidence recorded. Electron sandbox verification remains deferred and no M1 acceptance is claimed from this task alone.

## Risks
An incorrect migration can make existing local data inaccessible. Use additive migration, transactional runner, and disposable test databases only.

## Output Required
docs/verification/reports/phase-007-task-729.md
