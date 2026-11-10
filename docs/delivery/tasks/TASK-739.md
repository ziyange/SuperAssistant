# TASK-739: Supervise a read-only Codex App Server discovery process

## Status
APPROVED
PHASE: PHASE-007
MAX_ITERATIONS: 5
user_confirmed: true
Authorization: user-confirmed continuation of PHASE-007 remediation on the candidate branch.

## Requirement IDs
REQ-014, REQ-015, REQ-017, REQ-018, REQ-019, REQ-028, REQ-029, REQ-090, REQ-091, REQ-094

## Objective
Connect the existing isolated JSON-RPC handshake to an owned and bounded read-only child-process supervisor, without enabling execution or changing compatibility policy.

## Context Pack
- docs/adapters/codex.md
- docs/verification/reports/phase-007-task-735.md
- docs/verification/reports/phase-007-task-738.md

## Must Read
- AGENTS.md
- docs/README.md
- docs/requirements.md
- docs/architecture.md
- docs/security.md
- docs/api/sai.md
- docs/adapters/codex.md
- docs/verification/quality-gate.md
- packages/codex-adapter/src/app-server-discovery.ts
- packages/codex-adapter/src/worker.ts

## Allowed Files
- docs/delivery/tasks/TASK-739.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- docs/adapters/codex.md
- docs/verification/reports/phase-007-task-739.md
- packages/codex-adapter/src/app-server-supervisor.ts
- packages/codex-adapter/src/index.ts
- packages/codex-adapter/tests/app-server-supervisor.test.ts
- packages/codex-adapter/tests/fixtures/fake-app-server-rpc.mjs

## Forbidden Files
Do not change compatibility allowlists, existing execution operations, credentials, Electron sandbox, user projects, network configuration, archived evidence or lockfiles. No real Codex process or real Electron sandbox test.

## Interfaces / Contracts
The supervisor owns one child, calls the existing initialize/initialized/account-read transport, permits at most one initialize, stops owned process on handshake failure or explicit shutdown, and rejects a result after shutdown or child exit. Once its child exits, its adapter must not return stale connected health or capabilities. Unknown outcomes remain unavailable. The observed version is not compatibility proof.

## Data Constraints
Use disposable fake child processes with no network or credentials. Never expose upstream account identity or raw error output.

## UI Constraints
No renderer, UI or IPC changes. Unsupported versions remain unavailable and no new function becomes executable.

## Implementation Requirements
Write supervisor contract and failing integration tests before implementation. Retain the existing version gate, use fixed fake process only for tests, and do not expose provider-internal identifiers.

## Test Requirements
Run red and green supervisor tests with fake stdio child, including successful handshake, failure/timeout cleanup, repeated initialize, shutdown race and child exit. Run root strict typecheck, lint, unit and contract regression, docs checks, and anchored runtime trace. Real sandbox verification stays deferred.

## Acceptance Criteria
The fake child receives only read-only handshake methods. Supervisor does not leak child processes or report stale connected state. Repeated start and post-shutdown completion fail closed; all execution methods remain unavailable. No real Codex compatibility or desktop integration is claimed.

## Done Definition
Record exact commands, test outcomes, skipped tests and limitations; update adapter facts and retain historic evidence.

## Risks
Process/transport races can return stale health or leave child processes. Fake protocol fixtures do not establish production-version compatibility.

## Output Required
docs/verification/reports/phase-007-task-739.md
