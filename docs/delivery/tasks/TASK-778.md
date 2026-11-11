# TASK-778: Explicitly associate a Project with local Codex

## Status
APPROVED
PHASE: PHASE-007
MAX_ITERATIONS: 6
user_confirmed: true
Authorization: user requested autonomous completion of merge blockers and approved explicit Project-to-Agent routing.

## Requirement IDs
REQ-006, REQ-008, REQ-014, REQ-015, REQ-019, REQ-026, REQ-090, REQ-092, REQ-094, REQ-095, REQ-097, REQ-098

## Objective
Connect the saved local Codex identity to a selected Project through an explicit user action, with Workspace isolation, idempotency and Project snapshot invalidation. Do not enable execution or infer current Agent health.

## Context Pack
- docs/verification/reports/phase-007-task-777.md
- docs/architecture.md
- docs/ux.md

## Must Read
- AGENTS.md
- docs/README.md
- docs/product.md
- docs/requirements.md
- docs/architecture.md
- docs/data-model.md
- docs/security.md
- docs/ux.md
- docs/orchestration.md
- docs/verification/quality-gate.md
- docs/delivery/tasks/TASK-777.md

## Allowed Files
- docs/delivery/tasks/TASK-778.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- docs/architecture.md
- docs/data-model.md
- docs/security.md
- docs/ux.md
- apps/desktop/src/main/project-ipc.ts
- apps/desktop/src/main/ipc-schemas.ts
- apps/desktop/src/main/ipc-router.ts
- apps/desktop/src/main/main.ts
- apps/desktop/src/shared/ipc-contract.ts
- apps/desktop/src/preload/index.ts
- apps/desktop/src/renderer/project-center.tsx
- apps/desktop/src/renderer/App.tsx
- apps/desktop/tests/main/project-ipc.test.ts
- apps/desktop/tests/main/ipc-router.test.ts
- apps/desktop/tests/renderer/project-center.test.tsx
- .github/workflows/docs-gates.yml
- docs/verification/reports/phase-007-task-778.md

## Forbidden Files
No real or fake execution dispatch, Project filesystem modification, Agent auto-selection without user action, arbitrary renderer-provided Agent identity, overwriting another existing Agent assignment, credentials, user data, Electron sandbox, archived evidence, merge or branch cleanup.

## Interfaces / Contracts
The Renderer may request assignment by Project ID only; the main process resolves the unique persisted local Codex registration within the same active local-owner Workspace. The assignment transaction requires an ACTIVE Project and linked Agent, rejects foreign Projects and existing different defaults, increments Project snapshot and row versions exactly once on change, and is idempotent on repetition. An unavailable cached Agent may be configured but is never executable until current health and Function contracts are proven. Project projections expose boolean Codex-assignment and existing-default indicators, never paths, Agent identifiers or credentials; the latter prevents offering an implicit replacement.

## Data Constraints
Existing SQLite rows are authoritative. Use disposable SQLite, fake executable files and temporary Git Projects for tests. Assignment never creates a Task, Grant, Attempt or external effect.

## UI Constraints
Reuse Project Center cards. When a saved Codex registration exists, show an explicit Assign Codex action for an unassigned Project; show configured/recheck-needed state after success, bounded loading and generic errors. Never represent configuration as an available execution capability.

## Implementation Requirements
Update architecture, data, security and UX facts before code. Test explicit selection, foreign Workspace rejection, locked Workspace rejection, no registered Agent, non-active Project, existing conflicting Agent, idempotent repeated assignment, snapshot invalidation, database reopen, IPC schema and UI feedback. Do not automatically assign on registration.

## Test Requirements
Run targeted Project, IPC, registration and renderer tests, build, lint, typecheck, full unit and contract suites, governance and candidate CI. Real Codex and Electron sandbox remain deferred.

## Acceptance Criteria
The user can configure one selected active Project with the registered local Codex identity; repeated requests preserve the same snapshot version, whereas the first change increments it once. Cross-Workspace, locked, missing, inactive and conflicting identities produce no mutation. Renderer-provided Agent IDs and paths are rejected. Assignment alone never causes execution or live-status claims.

## Done Definition
Record actual local and CI evidence; current-health checks, Function discovery, Proposal creation and execution remain open.

## Risks
Configuration is not authorization or proof of Adapter availability. Conflicting existing Agent assignments require an explicit future replacement flow, not silent overwrite.

## Output Required
docs/verification/reports/phase-007-task-778.md
