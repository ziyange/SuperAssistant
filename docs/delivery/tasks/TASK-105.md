# TASK-105: Discover a local Codex runtime without side effects

## Status

APPROVED

PHASE: PHASE-001

MAX_ITERATIONS: 5

user_confirmed: true

## Requirement IDs

REQ-014, REQ-015, REQ-017, REQ-018, REQ-019, REQ-028, REQ-029, REQ-090, REQ-091, REQ-094

## Objective

Implement an isolated Codex Adapter Worker that starts App Server over local `stdio`, performs initialize/health/describe and authentication-state discovery, maps capabilities into product-neutral Agent/Function records, and cannot start a side-effecting execution.

## Context Pack

- `docs/api/sai.md`
- `docs/adapters/codex.md`
- `docs/decisions/ADR-002-codex-app-server-stdio.md`

## Must Read

- `AGENTS.md`
- `docs/requirements.md`
- `docs/api/sai.md`
- `docs/adapters/codex.md`
- `docs/security.md`
- `docs/operations.md`
- `docs/decisions/ADR-002-codex-app-server-stdio.md`

## Allowed Files

- packages/codex-adapter/src/worker.ts
- packages/codex-adapter/src/stdio-transport.ts
- packages/codex-adapter/src/discovery.ts
- packages/codex-adapter/src/protocol.ts
- packages/codex-adapter/src/error-map.ts
- packages/codex-adapter/src/index.ts
- packages/codex-adapter/tests/stdio-transport.test.ts
- packages/codex-adapter/tests/discovery.contract.test.ts
- packages/codex-adapter/tests/error-map.test.ts
- packages/codex-adapter/tests/fixtures/fake-app-server.mjs
- packages/codex-adapter/tests/fixtures/discovery-events.json
- apps/desktop/src/main/codex-discovery-ipc.ts
- apps/desktop/src/main/ipc-router.ts
- apps/desktop/src/shared/ipc-contract.ts
- apps/desktop/src/renderer/agent-center.tsx
- apps/desktop/tests/main/codex-discovery-ipc.test.ts
- apps/desktop/tests/renderer/agent-center.test.tsx
- docs/api/sai.md
- docs/adapters/codex.md
- docs/operations.md
- docs/verification/reports/phase-001-task-105.md

## Forbidden Files

- Any file not explicitly listed in Allowed Files.
- Codex Thread or Turn creation, tool approval, project mutation, arbitrary command execution, network transport, remote Task API, plaintext credentials, and product exposure of provider-native identifiers.

## Interfaces / Contracts

Implement only SAI `describe` and `health` for Phase 1. `start`, `resume`, `cancel`, `status`, `events`, and `result` return the documented capability-unavailable error without contacting an execution endpoint. Map App Server initialize, authentication, version, capabilities, and connection events inside the adapter boundary.

## Data Constraints

Persist product-neutral Agent, Function, capability, Connection, Availability, adapter version, protocol version, and last-health evidence. Credentials remain in Windows Credential Manager and are referenced by opaque identifier. Provider Thread/Turn values are not persisted in product tables.

## UI Constraints

Agent Center and Codex detail show Connection errors before Availability, otherwise Availability is principal. Show version, Functions, capability summaries, and authentication repair action. Do not show an execute control.

## Implementation Requirements

- Spawn App Server as a child process with bounded environment and validated executable path.
- Frame and parse `stdio` messages with size, timeout, and protocol validation.
- Terminate the complete worker/process tree on shutdown or failed initialization.
- Use a fake App Server for default contracts; real discovery is opt-in and read-only.

## Test Requirements

- Contract-test successful, auth-required, incompatible-version, malformed-frame, duplicate-event, timeout, and process-exit fixtures.
- Assert every execution operation fails closed and no Thread/Turn creation message is sent.
- Verify secret redaction and process-tree cleanup.
- Run optional real discovery only when explicitly enabled; record skip or result.
- Run lint, typecheck, unit, contract, renderer, and build commands.

## Acceptance Criteria

- Fake contracts produce correct product-neutral discovery and state precedence.
- Execution operations are unreachable and fail closed.
- No secret or provider-native execution identifier reaches product logs or UI.
- Worker failures release processes and remain recoverable on the next health check.

## Done Definition

Read-only discovery works against the fake server, optional real discovery is honestly reported, security/process tests pass, contracts match facts, and Phase 2 can activate execution without changing discovery semantics.

## Risks

`SECURITY_PERMISSION 0.600` is active and confirmed. Executable path, environment, credentials, process tree, and protocol input are trust boundaries. Upstream version drift is controlled by negotiation and fake contracts; remote execution remains denied.

## Output Required

Return changed files, supported protocol/version matrix, contract cases, redaction/process evidence, optional smoke status, and the phase report path.
