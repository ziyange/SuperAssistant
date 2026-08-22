# TASK-506: Expose bounded monitoring state
## Status
APPROVED
PHASE: PHASE-005
MAX_ITERATIONS: 6
user_confirmed: true
## Requirement IDs
REQ-066, REQ-067, REQ-068, REQ-069, REQ-090, REQ-094, REQ-096, REQ-099
## Objective
Expose a safe, read-only monitoring health projection and prove event-storm bounds.
## Context Pack
- docs/ux.md
- docs/security.md
- docs/orchestration.md
## Implementation Requirements
- Project Center exposes raw-evidence count, aggregate count, queue pressure, and blocked follow-up reasons without raw payloads or authorization bypass.
- A deterministic scenario proves duplicate retention, aggregation, cooldown, concurrency, and budget behavior under a bounded storm.
## Done Definition
Accessible monitoring state and SCN-MONITOR-BOUNDS evidence pass locally.
## Must Read
- AGENTS.md
- docs/ux.md
- docs/security.md
- docs/orchestration.md
- docs/operations.md
- docs/delivery/phase-005.md
## Allowed Files
- apps/desktop/src/shared/ipc-contract.ts
- apps/desktop/src/main/monitoring-status-ipc.ts
- apps/desktop/src/main/ipc-router.ts
- apps/desktop/src/main/ipc-schemas.ts
- apps/desktop/src/main/main.ts
- apps/desktop/src/preload/index.ts
- apps/desktop/src/renderer/monitoring-status.tsx
- apps/desktop/src/renderer/App.tsx
- apps/desktop/tests/main/monitoring-status-ipc.test.ts
- apps/desktop/tests/renderer/monitoring-status.test.tsx
- apps/desktop/tests/e2e/monitoring-bounds.spec.ts
- packages/domain/src/monitoring-status.ts
- packages/domain/src/index.ts
- packages/domain/tests/monitoring-status.test.ts
- packages/persistence/src/repositories/monitoring-status-repository.ts
- packages/persistence/src/index.ts
- packages/persistence/tests/monitoring-status-repository.test.ts
- docs/ux.md
- docs/security.md
- docs/orchestration.md
- docs/operations.md
- docs/verification/scenarios.md
- docs/delivery/tasks/TASK-506.md
- docs/verification/reports/phase-005-task-506.md
## Forbidden Files
Any file not explicitly listed; raw payload rendering; Task creation; Proposal or Grant creation; automatic side effects.
## Interfaces / Contracts
`monitoring:status` is a read-only IPC query and returns aggregate counts, bounded queue state, and redacted denial reasons only.
## Data Constraints
Projection reads existing immutable evidence; it stores no raw payload or credential.
## UI Constraints
Project Center presents a semantic monitoring region with loading, empty, and unavailable states; it does not add top-level navigation.
## Test Requirements
Run domain, persistence, IPC, renderer, storm E2E, lint, typecheck, build and governance gates.
## Acceptance Criteria
Users can inspect monitoring health without secrets, and deterministic storm evidence proves every gate before follow-up authorization.
## Risks
Unavailable or malformed monitoring state fails closed and renders truthful diagnostics.
## Output Required
Report read-only projection, storm scenario, and authorization-boundary evidence.

## Approved Revision

- 2026-08-22: the established secure IPC pattern validates every renderer
  channel in `ipc-schemas.ts` and registers it in `main.ts`; both exact paths
  are required to make this read-only projection reachable. The projection
  must show an unavailable collector truthfully rather than inventing live
  queue telemetry.
