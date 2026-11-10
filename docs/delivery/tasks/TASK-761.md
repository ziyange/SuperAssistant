# TASK-761: Bridge persisted outbox messages to the bounded dispatcher

## Status
APPROVED
PHASE: PHASE-007
MAX_ITERATIONS: 5
user_confirmed: true
Authorization: standing authorization for PHASE-007 integration remediation.

## Requirement IDs
REQ-027, REQ-030, REQ-038, REQ-049, REQ-092, REQ-093, REQ-099

## Objective
Make the claimed SQLite outbox command structurally usable by the existing dispatcher in isolated tests without enabling real execution.

## Context Pack
- docs/verification/reports/phase-007-task-755.md
- packages/persistence/src/repositories/outbox-repository.ts
- apps/desktop/src/main/outbox-dispatcher.ts

## Must Read
- AGENTS.md
- docs/README.md
- docs/requirements.md
- docs/data-model.md
- docs/security.md
- docs/orchestration.md
- docs/api/sai.md
- docs/verification/quality-gate.md
- docs/delivery/tasks/TASK-755.md

## Allowed Files
- docs/delivery/tasks/TASK-761.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- docs/orchestration.md
- docs/security.md
- docs/verification/reports/phase-007-task-761.md
- packages/persistence/src/repositories/outbox-repository.ts
- packages/persistence/tests/outbox-inbox.test.ts

## Forbidden Files
No main-process production wiring, real Codex or DSH execution, user project or database, Electron sandbox, credential, archive, remote or Git integration changes.

## Interfaces / Contracts
Claim a row using the existing fencing token and return a typed start or resume message with matching Attempt and payload identifiers. Only the existing start and resume payload shapes are accepted. Invalid JSON, unknown kinds, extra or missing fields, and a payload Attempt mismatch must not reach an adapter; quarantine the owned row for reconciliation. A lost claim never returns a dispatchable message. Acknowledgement and uncertainty retain token fencing. This shape is only an internal queue contract, not the complete SAI envelope.

## Data Constraints
Use in-memory SQLite and fake adapters. Preserve database transactions and existing claim, acknowledgement and restart behavior. Do not automatically requeue quarantined messages.

## UI Constraints
No UI changes.

## Implementation Requirements
Document contract before code. Prove a real SQLite claim can feed the real dispatcher and a fake adapter for start and resume. Add malformed, unknown kind and attempt mismatch rejection tests. Ensure a failed fake dispatch marks the row and Attempt uncertain. Keep real dispatch disabled.

## Test Requirements
Run targeted integration tests with RED then GREEN, build, lint, typecheck, full unit and contract suites, governance and anchored runtime verification. Report skipped tests and restrictions.

## Acceptance Criteria
Claimed start and resume payloads reach the matching fake adapter once; malformed commands cause no fake effect and are not automatically retried; stale claims cannot acknowledge; failed calls retain UNKNOWN reconciliation.

## Done Definition
Document observed results and acknowledge unresolved authority checks, real Adapter mapping, recovery and clean-SHA acceptance.

## Risks
The internal queue payload lacks authorization, snapshot and fencing envelope fields and cannot safely authorize a real Adapter call. Production dispatch must remain disabled.

## Output Required
docs/verification/reports/phase-007-task-761.md
