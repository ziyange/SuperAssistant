# TASK-787: Recover local abandoned execution claims on desktop startup

## Status
APPROVED
PHASE: PHASE-007
MAX_ITERATIONS: 5
user_confirmed: true
Authorization: explicit request to continue recovery and merge-gate remediation after verified worktree pinning. Real Codex and Electron sandbox validation remain deferred.

## Requirement IDs
REQ-036, REQ-037, REQ-049, REQ-092, REQ-093, REQ-097, REQ-099

## Objective
Run durable conservative local recovery after desktop acquires its instance lock, before showing recovered Task state or registering IPC.

## Context Pack
- docs/delivery/tasks/TASK-786.md
- docs/delivery/phase-007-integration-recovery.md

## Must Read
- AGENTS.md
- docs/README.md
- docs/orchestration.md
- docs/operations.md
- docs/verification/quality-gate.md

## Allowed Files
- .github/workflows/docs-gates.yml
- apps/desktop/src/main/main.ts
- apps/desktop/src/main/recovery-service.ts
- apps/desktop/tests/main/recovery-service.test.ts
- packages/persistence/src/repositories/outbox-repository.ts
- docs/delivery/execution-trace.json
- docs/delivery/permission-audit.log
- docs/delivery/tasks/TASK-787.md
- docs/operations.md
- docs/orchestration.md
- docs/verification/reports/phase-007-task-787.md

## Forbidden Files
All other files; no new IPC, live adapter calls, dispatch, approval, automatic retry, Lease release, terminal-result fabrication or merge.

## Interfaces / Contracts
The desktop starts the local SQLite application only after the Electron single-instance lock is acquired. Startup recovery runs before IPC. In one immediate transaction it checks for exactly one active local-owner Workspace. Its abandoned DISPATCHING Outbox rows become RECONCILING and lose their claim tokens. Externally ambiguous local Attempts become UNKNOWN. Terminal records, never-dispatched pending work, foreign workspaces and Leases remain unchanged. No unique active local Workspace means no recovery mutation.

## Data Constraints
Reuse current schema. Take scope from database ownership, not IPC. No external operations or synthetic terminal result. Preserve all original IDs and evidence.

## UI Constraints
Use existing Task projections for UNKNOWN or RECONCILING. No new recovery button or renderer contract.

## Implementation Requirements
Wire startup to the actual local database after exclusive app ownership. Continue to forbid redispatch until correlated durable terminal evidence is available. Recovery and its idempotence are tested without Electron or a live adapter.

## Test Requirements
Use real SQLite snapshots and claimed Outbox fixtures. Verify abandoned claim and acknowledged in-flight paths, old claim rejection, pending and terminal states preserved, foreign and locked/ambiguous Workspace isolation, repeat startup, and no new Attempt or Lease release. Run focused and complete local checks and candidate CI.

## Acceptance Criteria
Abandoned or in-flight work resumes in the truthful unknown state without being dispatched again. Repeated boot preserves the state. This completes only local startup quarantine, not App Server outcome reconciliation.

## Done Definition
Record red/green, exact scope and realistic fixture evidence; leave live reconciliation, trusted Function and Proposal confirmation gates accurately open.

## Risks
An Electron instance lock is not external worker termination. No code interprets it as permission to start or release a lease. Future live Adapter evidence must bind the original Attempt and resource fence.

## Output Required
[Verification evidence](../../verification/reports/phase-007-task-787.md)
