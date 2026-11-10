# TASK-749: Supervise read-only Codex status observations

## Status
APPROVED
PHASE: PHASE-007
MAX_ITERATIONS: 5
user_confirmed: true
Authorization: user-confirmed continuous PHASE-007 remediation using the approved local App Server architecture.

## Requirement IDs
REQ-014, REQ-015, REQ-018, REQ-028, REQ-029, REQ-049, REQ-090, REQ-091, REQ-098

## Objective
Keep the read-only observation client under the existing owned child-process supervisor and invalidate observations on failure, exit or shutdown.

## Context Pack
- docs/adapters/codex.md
- docs/verification/reports/phase-007-task-748.md
- packages/codex-adapter/src/app-server-supervisor.ts
- packages/codex-adapter/src/app-server-client.ts

## Must Read
- AGENTS.md
- docs/README.md
- docs/requirements.md
- docs/architecture.md
- docs/security.md
- docs/adapters/codex.md
- docs/api/sai.md
- docs/verification/quality-gate.md
- packages/codex-adapter/src/app-server-client.ts
- packages/codex-adapter/src/app-server-supervisor.ts

## Allowed Files
- docs/delivery/tasks/TASK-749.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- docs/adapters/codex.md
- docs/verification/reports/phase-007-task-749.md
- packages/codex-adapter/src/app-server-supervisor.ts
- packages/codex-adapter/src/app-server-client.ts
- packages/codex-adapter/tests/app-server-supervisor.test.ts
- packages/codex-adapter/tests/fixtures/fake-app-server-rpc.mjs

## Forbidden Files
Do not connect to renderer or a live Codex process, enable execution, alter version gating, credentials, sandbox controls, dependencies, archived evidence or user projects.

## Interfaces / Contracts
The supervisor owns one ReadOnlyAppServerClient over its child, offers internal observe for private thread identity and returns only ACTIVE, IDLE or INDETERMINATE. IDLE is not an Attempt terminal result. Shutdown disposes the client and rejects pending observations before terminating the child. A malformed or failed observation shuts down the child and invalidates cached discovery; no UI or SAI layer receives upstream identifiers.

Scope clarification under the user's standing authorization: expose read-only client readiness internally and reject cached health after an unsolicited protocol failure, including while no observation is pending.
Correction: the client path was mistakenly added only to Context Pack before transaction task-749-client-010. This explicit allowlist correction is prospective; the historical scope violation remains recorded in the task report.

## Data Constraints
Use only fake child processes and in-memory data. Preserve process termination evidence and never log raw payloads or account identity.

## UI Constraints
No UI or IPC changes and no execution capability is advertised.

## Implementation Requirements
Write failing fake-child tests for successful observation, pending observation shutdown and failure invalidation. Reuse the existing shared client and existing termination policy; do not add a second parser.

## Test Requirements
Run red/green supervisor tests and existing client/discovery tests, then build, lint, typecheck, full unit and contract suites and anchored runtime trace. Do not run live Codex or Electron sandbox tests.

## Acceptance Criteria
Only one child and client exist per supervisor; thread observations correlate through the same connection and are sanitized. Failure or shutdown rejects pending queries and invalidates old health. No redispatch or terminal success is inferred.

## Done Definition
Record exact commands, failures, skips and remaining actual protocol/recovery gaps.

## Risks
thread/read status is not a Task result; the client ignores active-turn events and cannot drive execution. Actual version compatibility, persistent correlation and restart reconciliation remain separate gates.

## Output Required
docs/verification/reports/phase-007-task-749.md
