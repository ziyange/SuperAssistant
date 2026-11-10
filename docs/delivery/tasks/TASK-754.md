# TASK-754: Prevent duplicate Outbox claims

## Status
APPROVED
PHASE: PHASE-007
MAX_ITERATIONS: 4
user_confirmed: true
Authorization: approved PHASE-007 integration remediation and continued autonomous execution.

## Requirement IDs
REQ-027, REQ-030, REQ-032, REQ-038, REQ-049, REQ-090, REQ-091, REQ-096, REQ-098

## Objective
A claimant must not receive an Outbox message if its compare-and-set from PENDING to DISPATCHING lost a concurrent race.

## Context Pack
- docs/verification/reports/phase-007-task-753.md
- packages/persistence/src/repositories/outbox-repository.ts
- packages/persistence/tests/outbox-inbox.test.ts

## Must Read
- AGENTS.md
- docs/README.md
- docs/requirements.md
- docs/data-model.md
- docs/security.md
- docs/orchestration.md
- docs/verification/quality-gate.md
- packages/persistence/src/repositories/outbox-repository.ts

## Allowed Files
- docs/delivery/tasks/TASK-754.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- docs/security.md
- docs/orchestration.md
- docs/verification/reports/phase-007-task-754.md
- packages/persistence/src/repositories/outbox-repository.ts
- packages/persistence/tests/outbox-inbox.test.ts

## Forbidden Files
No dispatcher wiring, adapter execution, user repositories, schema migrations, credentials, real Codex, Electron sandbox, archived evidence or Git integration.

## Interfaces / Contracts
claimNext returns a message only when its conditional state transition actually changed exactly one row. A loser returns null and may poll again. This does not authorize redispatch and does not claim fencing or crash reconciliation.

## Data Constraints
In-memory SQLite and controlled interleaving only. No external processes or application database.

## UI Constraints
No UI or IPC changes.

## Implementation Requirements
Write a deterministic interleaving test where a second repository wins between the first repository read and conditional update. Retain the existing claim and acknowledgement behavior.

## Test Requirements
Run red/green Outbox tests, build, lint, typecheck, full unit and contract suites, ordered governance and anchored goal runtime trace. Do not run real Codex or Electron sandbox tests.

## Acceptance Criteria
Exactly one contender receives the message for the same PENDING row; the losing conditional update returns null. Existing at-least-once inbox and acknowledgement tests remain passing.

## Done Definition
Record actual evidence and explicitly retain unresolved dispatch fencing, crash reconciliation and payload-contract work as blockers.

## Risks
This compare-and-set fix alone does not authenticate acknowledgement or recover a crashed DISPATCHING message. Do not wire the dispatcher until those contracts are designed and proven.

## Output Required
docs/verification/reports/phase-007-task-754.md
