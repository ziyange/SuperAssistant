# TASK-743: Bind local Grant and execution to the Workspace owner

## Status
APPROVED
PHASE: PHASE-007
MAX_ITERATIONS: 5
user_confirmed: true
Authorization: user-confirmed continuous PHASE-007 security remediation.

## Requirement IDs
REQ-001, REQ-024, REQ-025, REQ-027, REQ-028, REQ-090, REQ-094, REQ-095

## Objective
Enforce trusted local principal and active Workspace ownership on Grant issuance, initial execution and idempotent replay.

## Context Pack
- docs/security.md
- docs/verification/reports/phase-007-task-741.md
- docs/verification/reports/phase-007-task-742.md

## Must Read
- AGENTS.md
- docs/README.md
- docs/requirements.md
- docs/security.md
- docs/data-model.md
- docs/verification/quality-gate.md
- packages/persistence/src/repositories/authorization-repository.ts
- packages/persistence/src/repositories/execution-repository.ts

## Allowed Files
- docs/delivery/tasks/TASK-743.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- docs/security.md
- docs/verification/reports/phase-007-task-743.md
- packages/persistence/src/repositories/authorization-repository.ts
- packages/persistence/src/repositories/execution-repository.ts
- packages/persistence/tests/proposal-repository.test.ts
- packages/persistence/tests/execution-transaction.test.ts
- packages/persistence/tests/outbox-inbox.test.ts

## Forbidden Files
Do not enable dispatch, change Team RBAC, migrate schemas, modify dependencies, run real Codex or Electron sandbox tests, touch archived evidence or user databases.

## Interfaces / Contracts
Local repositories use a trusted principal provider at construction, defaulting to the existing local-owner identity. Grant issuance rejects actor mismatch or non-active/non-owned Workspace. Execution and matching replay require the Grant actor and active Workspace owner to match the trusted principal before returning or consuming. An untrusted renderer cannot supply the provider. Team-mode policy is outside this local-only boundary.

## Data Constraints
Only in-memory SQLite fixtures; rejection must not create, consume or disclose a Grant or Attempt. Existing trusted-clock behavior remains.

## UI Constraints
No UI or IPC changes.

## Implementation Requirements
Reproduce forged actor and cross-principal execution and replay first. Enforce ownership inside transaction and preserve valid replay and fake clock testing.

## Test Requirements
Cover forged actor, non-owner, inactive Workspace, wrong-principal initial execution and replay, legitimate owner and no partial writes. Run root build then lint, typecheck, full unit and contract regression and anchored runtime verification; do not run sandbox validation.

## Acceptance Criteria
Only the active local Workspace owner can create/use its Grant or inspect an execution replay through these methods; invalid principals cannot mutate state or receive existing Attempt identity.

## Done Definition
Record failures, fixes, commands and limits; initial resource policy still requires independent binding.

## Risks
A trusted principal provider must be created only by main/control plane; actor strings received from renderer are never authority. This local-owner rule does not replace Team RBAC.

## Output Required
docs/verification/reports/phase-007-task-743.md
