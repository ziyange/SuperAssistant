# TASK-748: Add a correlated read-only Codex App Server observation client

## Status
APPROVED
PHASE: PHASE-007
MAX_ITERATIONS: 5
user_confirmed: true
Authorization: user-confirmed continuous PHASE-007 remediation using the existing App Server architecture.

## Requirement IDs
REQ-014, REQ-015, REQ-018, REQ-028, REQ-029, REQ-049, REQ-090, REQ-091, REQ-098

## Objective
Replace the one-shot handshake parser with a reusable read-only client that correlates concurrent App Server observations and can query thread status without exposing upstream identifiers.

## Context Pack
- docs/adapters/codex.md
- docs/api/sai.md
- docs/verification/reports/phase-007-task-735.md
- docs/verification/reports/phase-007-task-747.md

## Must Read
- AGENTS.md
- docs/README.md
- docs/requirements.md
- docs/architecture.md
- docs/security.md
- docs/adapters/codex.md
- docs/api/sai.md
- docs/verification/quality-gate.md
- packages/codex-adapter/src/app-server-discovery.ts
- packages/codex-adapter/tests/app-server-discovery.test.ts

## Allowed Files
- docs/delivery/tasks/TASK-748.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- docs/adapters/codex.md
- docs/verification/reports/phase-007-task-748.md
- packages/codex-adapter/src/app-server-client.ts
- packages/codex-adapter/src/app-server-discovery.ts
- packages/codex-adapter/tests/app-server-client.test.ts

## Forbidden Files
No real Codex or model execution, UI/IPC changes, command execution, approval response, version allowlist changes, sandbox changes, dependencies, user files or archived evidence.

## Interfaces / Contracts
An internal ReadOnlyAppServerClient owns bounded newline JSON-RPC correlation on supplied child streams. It supports one initialize plus account/read handshake and thread/read status observation only; thread identifiers remain adapter-private. It projects ACTIVE, IDLE or INDETERMINATE without upstream IDs, account identity, raw errors or history. IDLE alone never proves an Attempt succeeded or permits redispatch. Notifications are ignored only in this read-only observation client; it must not be used for an active execution event stream.

## Data Constraints
Only in-memory fake streams. Maximum buffered frame size is 1 MiB, handshake has a total five-second default deadline, and request failures, server requests, unknown response IDs or process loss close the client and reject pending calls with sanitized errors.

## UI Constraints
No UI or IPC exposure; no new Function or execution capability is advertised.

## Implementation Requirements
Write failing tests first for initialization, fragmented frames, concurrent out-of-order observations, identifier mismatch, server requests, close and sanitization. Reuse the client for the existing discoverAppServer wrapper; preserve process ownership with its supervisor and existing compatibility gate.

## Test Requirements
Run red/green focused fake-stream tests, old discovery and supervisor tests, root build, lint, typecheck, full unit and contract suites and anchored runtime trace. No live App Server, model or Electron sandbox test.

## Acceptance Criteria
Only documented read-only initialize, initialized, account/read and thread/read messages are emitted; concurrent replies correlate to the correct query. Invalid, oversized, timed-out or unsolicited server requests fail closed. Product-facing projections contain no upstream identifiers or sensitive fields. No execution readiness is claimed.

## Done Definition
Record official documentation and local-version limitations, commands, results and skipped tests.

## Risks
thread/read returns a thread-level observation, not a terminal Attempt result. Lost notifications, missing correlation or unsupported versions stay UNKNOWN/RECONCILING; the observation client must not drive an active turn.

## Output Required
docs/verification/reports/phase-007-task-748.md
