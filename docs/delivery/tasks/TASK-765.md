# TASK-765: Supervise bounded lease renewal without enabling execution

## Status
APPROVED
PHASE: PHASE-007
MAX_ITERATIONS: 5
user_confirmed: true
Authorization: standing authorization for PHASE-007 execution recovery remediation.

## Requirement IDs
REQ-030, REQ-031, REQ-038, REQ-049, REQ-060, REQ-092, REQ-095, REQ-097, REQ-099

## Objective
Implement a bounded, explicitly started 10-second lease renewal supervisor over the persisted lease port, verified against SQLite without connecting a real Adapter.

## Context Pack
- docs/verification/reports/phase-007-task-764.md
- packages/persistence/src/repositories/resource-lease-repository.ts
- apps/desktop/src/main/recovery-service.ts

## Must Read
- AGENTS.md
- docs/README.md
- docs/requirements.md
- docs/architecture.md
- docs/data-model.md
- docs/security.md
- docs/orchestration.md
- docs/operations.md
- docs/verification/quality-gate.md
- docs/delivery/tasks/TASK-764.md

## Allowed Files
- docs/delivery/tasks/TASK-765.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- docs/architecture.md
- docs/security.md
- docs/orchestration.md
- docs/operations.md
- docs/verification/reports/phase-007-task-765.md
- apps/desktop/src/main/lease-renewal-supervisor.ts
- apps/desktop/tests/main/lease-renewal-supervisor.test.ts

## Forbidden Files
No main-process wiring, real worker or Adapter invocation, user database or Project, credentials, Electron sandbox, archived evidence, remote or Git integration.

## Interfaces / Contracts
An explicitly constructed supervisor owns one immutable lease identity, a synchronous trusted owner-liveness predicate, a lease port with canWrite and renew, and a loss notification callback. Start succeeds only once after liveness and initial validity are proven. While active it checks liveness and renews once every 10 seconds, without overlapping asynchronous work. Failed or throwing liveness, validity, or renewal moves it to LOST, clears timers and calls loss notification at most once. Notification exceptions are recorded as a failed notification flag and never turn LOST into success. Stop is idempotent, clears timers and never releases, reassigns, retries or kills a process. A stopped or lost instance cannot restart.

Loss notifications may return a Promise. A synchronous throw or asynchronous
rejection records notificationFailed and never becomes an unhandled rejection.
The flag is not proof of durable delivery while a Promise remains pending.

## Data Constraints
Use fake timers and isolated in-memory SQLite. A lease that expires, loses ownership or cannot renew remains present and blocking for later explicit reconciliation.

## UI Constraints
No UI changes.

## Implementation Requirements
Document before implementation. Use test-first integration against the SQLite lease repository for repeated renewal, long scheduling delay, failed ownership, exceptions, duplicate start and stop. Test callback failure and demonstrate that neither stop nor loss releases a lease.

## Test Requirements
Run RED and GREEN targeted tests, production build, lint, typecheck, full unit and contract suites, ordered governance and anchored goal runtime. Record skipped tests.

## Acceptance Criteria
Renewal occurs at 10-second intervals only while ownership and lease remain valid. Failure or expiration stops future renewal and triggers one loss notification. No lease is silently released or reassigned.

## Done Definition
Document results and keep production liveness, recovery transition, per-write fencing, real execution and merge gates open.

## Risks
An injected liveness predicate is not proof of actual process ownership. Event-loop stalls and failures must be reconciled; a timer cannot terminate or fence an external process.

## Output Required
docs/verification/reports/phase-007-task-765.md
