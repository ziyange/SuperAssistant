# TASK-835: Exercise real desktop Project registration and restart

## Status
IN_PROGRESS
PHASE: PHASE-007
MAX_ITERATIONS: 5
user_confirmed: true
Authority: user authorized uninterrupted work toward merge, using real Electron main-process IPC with fake services while deferring real Codex and Electron sandbox security verification.

## Requirement IDs
REQ-001, REQ-002, REQ-006, REQ-010, REQ-011, REQ-090, REQ-092, REQ-094, REQ-095

## Objective
Prove or repair actual desktop startup, Project registration and restart persistence using a disposable repository and isolated application data, without renderer API injection.

## Context Pack
- docs/delivery/tasks/TASK-834.md
- docs/architecture.md
- docs/data-model.md
- docs/ux.md
- docs/verification/quality-gate.md

## Must Read
- AGENTS.md
- docs/README.md
- docs/product.md
- docs/requirements.md
- docs/security.md
- docs/operations.md

## Allowed Files
- docs/delivery/tasks/TASK-835.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- docs/operations.md
- apps/desktop/tests/real-desktop/project-registration.spec.ts
- playwright.real-desktop.config.ts
- apps/desktop/src/main/main.ts
- apps/desktop/src/main/project-ipc.ts
- apps/desktop/src/renderer/App.tsx
- apps/desktop/src/renderer/project-center.tsx
- apps/desktop/package.json
- package.json
- package-lock.json

## Forbidden Files
All other repository files, user projects and actual user application data, production credentials, remote operations, merge, real Codex and Electron sandbox security verification.

## Interfaces / Contracts
Start the built Electron application with a unique disposable application-data root. A test-owned temporary bootstrap must set Electron's `userData` path before importing the unchanged application main module, since environment substitution alone does not isolate it on Windows. Exercise its real preload, main-process IPC, SQLite and renderer. A test-only native file-dialog replacement may select only the disposable test Git repository. Never inject or replace `window.superAssistant`. Application startup and registration must not claim execution availability. Any implementation change must retain production security defaults.

## Data Constraints
Temporary synthetic repository and test-owned profile only. Verify selected paths and worktree ownership before any cleanup; retain uncertain artifacts. No production database, credentials or user project may be opened or changed.

## UI Constraints
Prove existing onboarding and Project Center interaction; do not change the intended interface or enable unverified execution.

## Implementation Requirements
Add a genuine Electron process test for startup, selecting a disposable Project via the native-dialog boundary, registration, application restart and persisted Project display. If startup or persistence fails, identify root cause and fix only allowed files. Keep real sandbox-security and Codex verification deferred.

## Test Requirements
Run the real desktop test without renderer API injection. Show a failing regression before any application fix. Run affected tests, lint, typecheck, build, governance and file boundaries; preserve failure evidence when required runtimes are unavailable.

## Acceptance Criteria
Both launches use isolated data; the first registers exactly the disposable Project through real IPC, and the second displays it from persisted SQLite state. No real Codex operation or sandbox-security assertion occurs. This is not the complete H1 flow or merge acceptance.

## Done Definition
Record exact commands, versions and test evidence; update owning facts and commit the scoped result only after checks pass.

## Risks
Electron native modules may require an ABI-compatible build; never rebuild or replace user-owned dependencies indiscriminately. GUI/process availability may block the test. Native-dialog replacement does not prove OS dialog behavior or sandbox security.

## Output Required
Real Electron registration/restart test and evidence, plus any narrowly scoped application fix exposed by the test.

## Isolation incident
The initial test relied on a child-only `APPDATA` override. Electron instead
opened `C:/Users/ZZY/AppData/Roaming/Electron/super-assistant.sqlite` before
the assertion caught the mismatch. The file's creation and modification
timestamps match the test startup; its pre-test state cannot be independently
proven. No Project selection or Codex operation occurred. The test process has
exited. The file is preserved, not deleted or restored; its observed SHA-256 is
`9fd7f1298ed1f7184c11fad6fb985510a36f08575ac033ea06c8014fc1b85215`.
Future launches must use a bootstrap that sets `userData` before application
startup, and must confirm that the shared file's hash is unchanged.

## Current result
After setting `userData` before importing the application, the isolated launch
reached a real window and the shared database hash remained unchanged. The
renderer did not show its heading. The built `index.html` references
`/assets/...` while the desktop loads it via `file://`; a separate authorized
task must test and fix that build-path issue because the Vite config is outside
this Task Pack. Registration and restart remain unverified. The test and this
record are retained as WIP; no completion, H1 or merge claim is made.
