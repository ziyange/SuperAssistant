# TASK-764: Persist bounded H1 ResourceLease expiry and renewal

## Status
APPROVED
PHASE: PHASE-007
MAX_ITERATIONS: 5
user_confirmed: true
Authorization: standing authorization for PHASE-007 safety and recovery remediation.

## Requirement IDs
REQ-030, REQ-031, REQ-038, REQ-049, REQ-060, REQ-092, REQ-093, REQ-095, REQ-097, REQ-099

## Objective
Add durable 30-second H1 lease expiry and token-fenced renewal without treating expiry as permission to reassign or retry.

## Context Pack
- docs/verification/reports/phase-007-task-763.md
- packages/persistence/src/repositories/resource-lease-repository.ts
- packages/persistence/src/sqlite/migrations/004-execution.sql

## Must Read
- AGENTS.md
- docs/README.md
- docs/requirements.md
- docs/data-model.md
- docs/security.md
- docs/orchestration.md
- docs/operations.md
- docs/verification/quality-gate.md
- docs/delivery/tasks/TASK-755.md

## Allowed Files
- docs/delivery/tasks/TASK-764.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- docs/data-model.md
- docs/security.md
- docs/orchestration.md
- docs/operations.md
- docs/verification/reports/phase-007-task-764.md
- packages/persistence/src/sqlite/migration-runner.ts
- packages/persistence/src/sqlite/migrations/020-resource-lease-expiry.sql
- packages/persistence/src/repositories/resource-lease-repository.ts
- packages/persistence/tests/migration-runner.test.ts
- packages/persistence/tests/resource-lease-expiry.test.ts
- packages/persistence/tests/outbox-inbox.test.ts

## Execution Expansion
The standing remediation authorization covers this exact additional test
file. Its version-18 fixture must use version-18 SQL instead of the current
repository, which now correctly requires migration 020. Preserve the
interrupted-claim and Attempt reconciliation assertions.

## Forbidden Files
No previously published migration edits, user database, real Adapter execution, application wiring, credentials, Electron sandbox, archive, remote or Git integration.

## Interfaces / Contracts
Migration 020 adds nullable renewed_at and expires_at fields. Existing rows retain nulls and are not automatically released; null expiry is never valid write authority. New acquisition uses canonical UTC createdAt from its trusted caller and sets renewed_at to createdAt and expires_at to createdAt plus 30 seconds. A repository-injected trusted clock defaults to system UTC. Renewal requires matching lease ID, Attempt, fencing token, ACTIVE state, canonical clock, now not before renewed_at and strictly before expiry; it atomically sets renewed_at to now and expiry to now plus 30 seconds. Validity checks require the same owner, token, ACTIVE state, canonical timestamps and now in the renewal interval. Expired, malformed, missing or legacy expiry never authorizes writes, renewal, automatic release or redispatch.

The migration also adds nullable last_observed_at. New leases initialize it
to createdAt. Each validity or renewal check persistently advances this
high-water mark before deciding validity, including a first observed expiry.
A clock value earlier than the stored mark fails closed even after restart;
renewal is conditional on the same observation and cannot overwrite a newer
check. No check can detect a clock jump that occurred without being observed.

## Data Constraints
Use isolated in-memory or temporary SQLite fixtures. Keep legacy active leases blocking until separate explicit recovery. Never auto-delete a backup or modify a user database. Timestamp strings must be canonical UTC milliseconds.

## UI Constraints
No UI changes.

## Implementation Requirements
Write engineering facts first, then failing tests for acquisition, renewal, exact deadline, wrong token and owner, clock rollback, released and legacy leases, persistence across reopen and migration backup. Add forward-only migration 020; update migration regression tests for the new current version without weakening old-migration assertions.

## Test Requirements
Run targeted RED and GREEN tests, migration/backup suite, build, lint, typecheck, full unit and contract suites, governance and anchored goal runtime. Record any skips or unavailable environments.

## Acceptance Criteria
Valid leases are write-eligible only during their current 30-second window; expired or unknown leases block new acquisition until explicit safe recovery. Incorrect owner or token cannot renew. Historical rows are preserved and fail closed.

## Done Definition
Record observed evidence; production dispatch and independent per-write fencing stay disabled until an Adapter enforces the capability and lifecycle.

## Risks
Wall-clock rollback or unavailable time fails closed; forward clock jumps can deny work early. A lease deadline alone cannot terminate a process or stop an Adapter that ignores fencing. This task does not prove end-to-end containment.

## Output Required
docs/verification/reports/phase-007-task-764.md
