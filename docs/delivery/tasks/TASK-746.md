# TASK-746: Bound synthetic cancellation and preserve uncertain outcomes

## Status
APPROVED
PHASE: PHASE-007
MAX_ITERATIONS: 5
user_confirmed: true
Authorization: user-confirmed continuous PHASE-007 safety remediation.

## Requirement IDs
REQ-029, REQ-030, REQ-031, REQ-033, REQ-090, REQ-093, REQ-098

## Objective
Enforce the approved cancellation time limits without reporting completion or retrying an uncertain side effect.

## Context Pack
- docs/adapters/codex.md
- docs/operations.md
- docs/verification/reports/phase-007-task-745.md

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
- docs/delivery/tasks/TASK-746.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- docs/adapters/codex.md
- docs/verification/reports/phase-007-task-746.md
- packages/codex-adapter/src/execution.ts
- packages/codex-adapter/tests/cancel.contract.test.ts

## Forbidden Files
Do not connect synthetic protocol to real Codex, alter SQLite schema, dependencies, permissions, sandbox settings, archived evidence or user data.

## Interfaces / Contracts
Interrupt wait is at most 5 seconds. Interrupt, termination and lease release share an overall 15-second deadline. A timeout returns CANCELLATION_INCOMPLETE, must not trigger release without verified termination, and must not retry a possibly committed late effect. Failed or timed-out interrupt still attempts owned-process termination while time remains but retains the lease for reconciliation. Fake timers are test-only.

## Data Constraints
Only fake transports and callbacks; no real process, project or external side effect.

## UI Constraints
No UI or IPC changes.

## Implementation Requirements
Reproduce hung interrupt, terminator and release using fake timers, then implement deadline-aware fail-closed handling without changing successful order or expanding privileges.

## Test Requirements
Cover all hung stages, late callbacks, successful cancellation and no premature release; run build, lint, typecheck, full unit and contract suites and anchored runtime trace. Do not run Electron sandbox validation.

## Acceptance Criteria
Each call settles no later than the documented total deadline under a functioning event loop; a timed-out interrupt or termination never calls release. A timed-out release remains explicitly incomplete and is not repeated automatically.

## Done Definition
Record red/green tests, full regression, skips and real-process limitations.

## Risks
A promise timeout cannot undo an external operation; outcome remains uncertain and reconciliation is mandatory. Actual process identity and termination proof remain separate production gates.

## Output Required
docs/verification/reports/phase-007-task-746.md
