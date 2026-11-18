# TASK-783: Persist local non-authoritative Proposal drafts

## Status
APPROVED
PHASE: PHASE-007
MAX_ITERATIONS: 5
user_confirmed: true
Authorization: user requested continuous remediation of Proposal integration.

## Requirement IDs
REQ-008, REQ-022, REQ-024, REQ-090, REQ-092, REQ-094, REQ-099

## Objective
Store and retrieve immutable local Proposal candidate drafts after structural and catalog checks without creating an approval or execution.

## Context Pack
- docs/data-model.md
- docs/orchestration.md
- docs/delivery/tasks/TASK-782.md

## Must Read
- AGENTS.md
- docs/README.md
- docs/product.md
- docs/requirements.md
- docs/architecture.md
- docs/data-model.md
- docs/security.md
- docs/orchestration.md
- docs/verification/quality-gate.md

## Allowed Files
- docs/delivery/tasks/TASK-783.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- docs/data-model.md
- docs/orchestration.md
- packages/persistence/src/sqlite/migrations/023-proposal-drafts.sql
- packages/persistence/src/sqlite/migration-runner.ts
- packages/persistence/tests/migration-runner.test.ts
- apps/desktop/src/main/proposal-draft-store.ts
- apps/desktop/tests/main/proposal-draft-store.test.ts
- .github/workflows/docs-gates.yml
- docs/verification/reports/phase-007-task-783.md

## Forbidden Files
All other files; do not modify historic Proposal or Grant records, user projects, IPC, UI, credentials or execution.

## Interfaces / Contracts
The main-process store creates a generated immutable draft ID and stores a validated detached candidate only when the local catalog matches within the same SQLite transaction. Retrieval requires the active unique local Workspace and verifies the stored SHA-256 bytes before parsing. The digest is an integrity checksum of stored draft JSON, not an RFC 8785 authorization digest. All output remains draft-only.

## Data Constraints
Forward-only migration adds draft table and update/delete rejection triggers; preserve all legacy rows. Do not store executable paths, credential values or external effects. Caller-supplied secret-free draft content remains untrusted data, not authority.

## UI Constraints
No UI, IPC or confirmation exposure.

## Implementation Requirements
Document the contract first; use real SQLite transactions, recheck local catalog before saving and Workspace ownership before reading, and fail closed on tampering.

## Test Requirements
Use temporary or in-memory SQLite; cover reopen, immutability, wrong Workspace, malformed input, stale Project, failed validation without writes, checksum tampering, migration and legacy compatibility. Run focused, full unit and contract tests, lint, typecheck, build and governance.

## Acceptance Criteria
Only valid locally scoped drafts are saved and recovered with their exact structured content; no Grant, Task, Attempt or external effect is created. Missing live state still blocks confirmation.

## Done Definition
Record actual tests, runtime Exit 0 and exact file scope. Existing approval and execution remain disconnected.

## Risks
Candidate text can contain user-provided sensitive information; this task must not claim secret detection. Drafts are not reviewed or authorized and cannot be used as ProposalVersion.

## Output Required
docs/verification/reports/phase-007-task-783.md
