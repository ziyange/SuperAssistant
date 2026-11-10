# TASK-747: Prevent duplicate synthetic cancellation side effects

## Status
APPROVED
PHASE: PHASE-007
MAX_ITERATIONS: 5
user_confirmed: true
Authorization: user-confirmed continuous PHASE-007 safety remediation.

## Requirement IDs
REQ-027, REQ-029, REQ-030, REQ-031, REQ-033, REQ-090, REQ-093, REQ-098

## Objective
Deduplicate concurrent and repeated cancellation for one Attempt within the synthetic adapter instance, including unresolved outcomes.

## Context Pack
- docs/adapters/codex.md
- docs/verification/reports/phase-007-task-746.md

## Must Read
- AGENTS.md
- docs/README.md
- docs/requirements.md
- docs/security.md
- docs/adapters/codex.md
- docs/api/sai.md
- docs/verification/quality-gate.md
- packages/codex-adapter/src/execution.ts

## Allowed Files
- docs/delivery/tasks/TASK-747.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- docs/adapters/codex.md
- docs/verification/reports/phase-007-task-747.md
- packages/codex-adapter/src/execution.ts
- packages/codex-adapter/tests/cancel.contract.test.ts

## Forbidden Files
Do not connect the synthetic transport to real Codex, change SQLite schema, dependencies, external permissions, sandbox controls, archived evidence or user data.

## Interfaces / Contracts
A valid Attempt/process identity has at most one in-flight cancellation operation per adapter instance. Concurrent or repeated identical calls reuse the first outcome, including incomplete or timed-out outcomes; a changed process identity for the same Attempt is rejected. Invalid identity fails before interrupt. No automatic repeat of a potentially committed release occurs. This in-memory behavior does not provide restart durability.

## Data Constraints
Tests use fake transports and callbacks; no real process or external side effect.

## UI Constraints
No UI or IPC changes.

## Implementation Requirements
Reproduce duplicate concurrent effects, changed-process collision and retry after an uncertain release before implementing. Preserve TASK-745 failure ordering and TASK-746 deadlines.

## Test Requirements
Test concurrent calls, same-key replay, changed process, incomplete timeout replay, invalid identity and successful order. Run root build, lint, typecheck, full unit and contract suites and anchored runtime trace. No Electron sandbox validation.

## Acceptance Criteria
One adapter instance invokes interrupt, process termination and lease release no more than once for an Attempt; retries after an uncertain result do not invoke them again. Restart recovery is explicitly unproven.

## Done Definition
Record red/green tests, full regression and limitations.

## Risks
In-memory deduplication is not durable across worker restart; a durable control-plane cancellation record and reconciliation are required before real dispatch.

## Output Required
docs/verification/reports/phase-007-task-747.md
