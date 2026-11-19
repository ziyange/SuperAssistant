# TASK-784: Connect Proposal preparation to the local desktop catalog

## Status
APPROVED
PHASE: PHASE-007
MAX_ITERATIONS: 5
user_confirmed: true
Authorization: existing approval to continue PHASE-007 integration, including real H1 desktop bindings; real execution and Electron sandbox verification remain deferred.

## Requirement IDs
REQ-003, REQ-008, REQ-017, REQ-022, REQ-090, REQ-094, REQ-097, REQ-098, REQ-099

## Objective
Replace the home-screen placeholder with a real, read-only Project-specific routing check that explains what is missing before a Proposal can be prepared.

## Context Pack
- docs/delivery/phase-007-integration-recovery.md
- docs/delivery/tasks/TASK-782.md
- docs/delivery/tasks/TASK-783.md

## Must Read
- AGENTS.md
- docs/README.md
- docs/product.md
- docs/requirements.md
- docs/architecture.md
- docs/data-model.md
- docs/security.md
- docs/ux.md
- docs/verification/quality-gate.md

## Allowed Files
- docs/delivery/tasks/TASK-784.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- docs/architecture.md
- docs/ux.md
- apps/desktop/src/shared/ipc-contract.ts
- apps/desktop/src/preload/index.ts
- apps/desktop/src/main/main.ts
- apps/desktop/src/main/ipc-router.ts
- apps/desktop/src/main/ipc-schemas.ts
- apps/desktop/src/main/proposal-catalog-check.ts
- apps/desktop/src/renderer/App.tsx
- apps/desktop/src/renderer/proposal-review.tsx
- apps/desktop/tests/main/proposal-catalog-check.test.ts
- apps/desktop/tests/renderer/proposal-review.test.tsx
- apps/desktop/tests/e2e/proposal-confirmation.spec.ts
- .github/workflows/docs-gates.yml
- docs/verification/reports/phase-007-task-784.md

## Forbidden Files
Every other file. No draft write IPC, policy changes, execution, database migrations, user projects or Git publication of main.

## Interfaces / Contracts
The trusted desktop boundary accepts only a bounded Project ID on proposal:context. Main derives Workspace and reads Project status, matching registered default Codex and existence of a versioned active Function in one SQLite read transaction. Output is one enumerated state and nothing else: PROJECT_UNAVAILABLE, CODEX_REQUIRED, FUNCTION_REQUIRED or LIVE_VERIFICATION_REQUIRED. Invalid input is rejected; ambiguous authority or failed storage reads yield PROJECT_UNAVAILABLE. None of these states grants authorization.

## Data Constraints
No file paths, raw catalog rows, credentials, goal text, or capability observations are accepted or returned. No process, network, draft, ProposalVersion, Grant, Task or Attempt is created.

## UI Constraints
Reuse the existing home review location. Show an explicit Project selector, loading/empty/error and prerequisite feedback, and keep confirmation disabled without a handler. Ignore late responses for superseded requests.

## Implementation Requirements
Document changed contracts before code, preserve the existing trusted sender and strict schema checks, add the new read through preload and main, and leave legacy authorization ports disconnected. Record deterministic browser results separately from Electron acceptance.

## Test Requirements
Use in-memory SQLite and real router schemas for success, absent/foreign/paused Projects, locked or ambiguous Workspace, missing/mismatched or disabled Codex, inactive Function, storage failure and zero writes. Test renderer selection and late results; run the targeted browser scenario if available, build, lint, typecheck, complete unit and contract suites and governance.

## Acceptance Criteria
Selecting an active Project shows main-process catalog facts and actionable next prerequisites. Nothing can be approved, persisted or dispatched from this screen. Missing Project authority does not leak foreign state. No H1 or merge milestone is declared.

## Done Definition
Capture Red and Green evidence, test scope and deferrals in the linked report, and pass the runtime trace and actual file boundary.

## Risks
Catalog records do not prove App Server health, Git baseline, permission state or safe resource containment. No READY state is permitted.

## Output Required
[Verification evidence](../../verification/reports/phase-007-task-784.md)
