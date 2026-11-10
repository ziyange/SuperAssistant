# TASK-751: Fail closed on invalid actions and preflight times

## Status
APPROVED
PHASE: PHASE-007
MAX_ITERATIONS: 5
user_confirmed: true
Authorization: user-approved PHASE-007 security remediation and continued autonomous execution.

## Requirement IDs
REQ-020, REQ-021, REQ-025, REQ-026, REQ-027, REQ-090, REQ-091, REQ-098

## Objective
Prevent unknown actions and invalid or changed grant expiry from being interpreted as read-only or preflight-ready.

## Context Pack
- docs/delivery/phase-007-integration-recovery.md
- docs/verification/reports/phase-007-task-750.md
- packages/domain/src/routing.ts
- packages/domain/src/preflight.ts

## Must Read
- AGENTS.md
- docs/README.md
- docs/requirements.md
- docs/security.md
- docs/orchestration.md
- docs/data-model.md
- docs/verification/quality-gate.md
- packages/domain/src/routing.ts
- packages/domain/src/preflight.ts
- apps/desktop/src/main/ipc-schemas.ts

## Allowed Files
- docs/delivery/tasks/TASK-751.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- docs/security.md
- docs/orchestration.md
- docs/verification/reports/phase-007-task-751.md
- packages/domain/src/routing.ts
- packages/domain/src/preflight.ts
- packages/domain/tests/routing.test.ts
- packages/domain/tests/preflight.test.ts
- apps/desktop/src/main/ipc-schemas.ts
- apps/desktop/tests/main/ipc-router.test.ts

## Forbidden Files
No execution dispatch, renderer wiring, database migration, credential access, real Codex, user projects, archived evidence or Git integration.

## Interfaces / Contracts
Unknown or non-string actions are rejected at IPC and domain boundaries, never classified READ_ONLY. Invalid approved/current grant expiry or checkedAt yields STALE with INVALID_TIME; a changed grant expiry yields STALE with GRANT_CHANGED. Existing reasons retain their semantics. These checks do not make renderer-supplied snapshots authoritative; production preflight remains disabled until derived from trusted persisted state.
Empty and sparse action arrays are invalid: a read-only query must identify
at least one READ action, and holes cannot be skipped by array validation.
Grant expiry and check times use the canonical UTC millisecond ISO-8601 form
produced by Date.toISOString; parser normalization of invalid calendar dates
or ambiguous noncanonical strings is rejected.

## Data Constraints
No credentials, network, application database or external process. Tests use deterministic in-memory snapshots.

## UI Constraints
No visible UI changes. Do not register a new IPC handler or enable Proposal execution.

## Implementation Requirements
Write failing tests for arbitrary action strings, malformed types, invalid dates and extended/changed expiry; update docs before code. Preserve existing valid read-only and unchanged valid grant behavior.

## Test Requirements
Target domain and IPC red/green tests, build, lint, typecheck, full unit and contract suites, and ordered governance plus goal-mode runtime trace. No real Codex or Electron sandbox tests.

## Acceptance Criteria
Unknown action values never produce READ_ONLY; invalid time never produces READY; any changed valid expiry forces STALE. Existing legitimate unchanged snapshots still pass. No preflight snapshot supplied by renderer gains authority.

## Done Definition
Record evidence and omissions; keep integrated H1 and G3/G4 unaccepted.

## Risks
Snapshot shape lacks a grant identity and is insufficient alone to prove authorization; the eventual dispatcher must load and validate the actual grant from the platform database.

## Output Required
docs/verification/reports/phase-007-task-751.md
