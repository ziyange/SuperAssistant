# TASK-735: Add version-gated Codex App Server read-only handshake

## Status
APPROVED
PHASE: PHASE-007
MAX_ITERATIONS: 5
user_confirmed: true
Authorization: user-approved continuous H1 remediation; real sandbox and real model smoke remain deferred.

## Requirement IDs
REQ-014, REQ-015, REQ-017, REQ-018, REQ-019, REQ-028, REQ-029, REQ-090, REQ-091, REQ-094

## Objective
Provide an isolated, testable read-only JSON-RPC App Server initialization and account-status handshake without claiming execution compatibility.

## Context Pack
- docs/adapters/codex.md
- docs/verification/reports/phase-007-task-734.md
- docs/delivery/tasks/TASK-105.md

## Must Read
- AGENTS.md
- docs/README.md
- docs/requirements.md
- docs/architecture.md
- docs/security.md
- docs/adapters/codex.md
- docs/api/sai.md
- docs/verification/quality-gate.md
- packages/codex-adapter/src/stdio-transport.ts
- packages/codex-adapter/src/protocol.ts

## Allowed Files
- docs/delivery/tasks/TASK-735.md
- docs/verification/reports/phase-007-task-735.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- docs/adapters/codex.md
- docs/operations.md
- packages/codex-adapter/src/app-server-discovery.ts
- packages/codex-adapter/src/index.ts
- packages/codex-adapter/tests/app-server-discovery.test.ts

## Forbidden Files
Do not change or enable Codex execution, user credentials, version allowlists, sandbox controls, real model or real Electron tests, package locks, archived evidence or user projects.

## Interfaces / Contracts
The new isolated transport sends initialize with clientInfo, then initialized, then account/read with refreshToken false; it parses bounded newline JSON-RPC responses, matches request IDs, ignores valid notifications, and projects only a boolean account observation. It must not return codexHome, account identity, tokens or raw upstream payload. Externally supplied CLI version is an observation only; existing compatibility gating remains unchanged.

## Data Constraints
No database, network, real Codex process, external side effect, credential or account mutation. Tests use in-memory fake streams only.

## UI Constraints
No UI or IPC exposure; unsupported and unverified versions remain unavailable.

## Implementation Requirements
Document that older fake discovery and fake execution frames are not real App Server evidence. Test fragmented and combined frames, notifications, errors, timeout and oversize boundaries before implementation. Keep actual process ownership and lifecycle with the existing future supervisor.

## Test Requirements
Run failing focused tests before implementation, focused unit and contract suites, TypeScript, lint, full unit regression, and runtime verification. Do not invoke real App Server or real Electron in this task.

## Acceptance Criteria
Only the expected read-only methods are sent, response IDs correlate correctly, split frames are handled, malformed/oversized frames and errors fail closed, timeout is bounded, and returned data excludes private upstream identity. Existing execution remains unavailable and existing version gating is not widened.

## Done Definition
Record exact local schema source/version, test commands and limits. This isolated handshake does not prove real Codex compatibility or M1 completion.

## Risks
Locally generated 0.157.1 schemas do not prove compatibility with 0.121.x or a live authenticated process. A timeout or lost response must never imply that a side effect did not occur.

## Output Required
docs/verification/reports/phase-007-task-735.md
