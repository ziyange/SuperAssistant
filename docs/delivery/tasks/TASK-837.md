# TASK-837: Real desktop fake App Server discovery and Proposal review

## Status
IN_PROGRESS
PHASE: PHASE-007
MAX_ITERATIONS: 5
user_confirmed: true
Authority: user authorized real desktop integration with a fake App Server and uninterrupted work toward merge; real Codex and sandbox-security verification remain deferred.

## Requirement IDs
REQ-006, REQ-010, REQ-014, REQ-015, REQ-017, REQ-019, REQ-020, REQ-021, REQ-024, REQ-090, REQ-092, REQ-094, REQ-095

## Objective
Exercise the real Electron main-process path from a disposable Project and a fake Codex executable through discovery, assignment and complete native Proposal review, without claiming execution or authorization.

## Context Pack
- docs/delivery/tasks/TASK-835.md
- docs/delivery/tasks/TASK-836.md
- docs/adapters/codex.md
- docs/security.md
- docs/ux.md

## Must Read
- AGENTS.md
- docs/README.md
- docs/product.md
- docs/requirements.md
- docs/architecture.md
- docs/data-model.md
- docs/operations.md
- docs/verification/quality-gate.md

## Allowed Files
- docs/delivery/tasks/TASK-837.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- docs/operations.md
- docs/ux.md
- apps/desktop/tests/real-desktop/project-registration.spec.ts
- apps/desktop/tests/real-desktop/fake-codex.cs
- playwright.real-desktop.config.ts
- apps/desktop/src/main/main.ts
- apps/desktop/src/main/codex-discovery-ipc.ts
- apps/desktop/src/main/local-codex-registration.ts
- apps/desktop/src/main/local-goal-draft.ts
- apps/desktop/src/main/review-window.ts
- apps/desktop/src/main/project-ipc.ts
- apps/desktop/src/renderer/App.tsx
- apps/desktop/src/renderer/agent-center.tsx
- apps/desktop/src/renderer/project-center.tsx
- apps/desktop/src/renderer/proposal-review.tsx
- packages/codex-adapter/src/app-server-client.ts
- packages/codex-adapter/src/app-server-supervisor.ts

## Forbidden Files
Other repository files, user projects or credentials, real Codex, real Electron sandbox-security verification, production execution activation, remote merge and release.

## Interfaces / Contracts
Use a compiled test-owned executable implementing only version reporting and read-only App Server initialization and account discovery. It must not perform real network, filesystem or execution actions. The real Electron preload, IPC, SQLite and native review window are exercised. Fake only OS file selection; never replace `window.superAssistant` or the authorization path. Proposal review must explicitly remain review-only: no Grant, Attempt or process start.

## Data Constraints
Use a new test-owned profile set before app startup and a disposable Git repository. Preserve and hash-check the shared Electron database before and after every local run. Synthetic account and goal only; no credentials.

## UI Constraints
Use real navigation and review window. Confirm full goal and criterion shown, and the interface accurately states that review did not authorize execution.

## Implementation Requirements
Compile a minimal fake version/discovery server in the test output directory, register and assign it through the real desktop path, create a Proposal draft and acknowledge the native review. Reproduce and repair real integration failures only inside the allowed files. Do not enable production execution or change sandbox policy.

## Test Requirements
Run real Electron test, ensure fixture process termination, confirm no Grant or Attempt after review, run browser E2E, lint, typecheck, build, unit, contract and governance. Never silently skip the fake executable or real UI test.

## Acceptance Criteria
The real desktop identifies the fake server as connected, associates it with the disposable Project, shows complete Proposal content in the main-owned review and reports review-only, without any Grant, Attempt or project modification. Shared database hash remains unchanged and no fake process remains alive.

## Done Definition
Record local and CI evidence precisely and commit; this test is not real Codex, sandbox, full H1 or merge acceptance.

## Risks
Native Windows compiler availability and desktop runner support may block validation. Fixture process termination cannot establish production process ownership or cancellation.

## Output Required
Real desktop fake-discovery and Proposal review test, fixture and any evidenced scoped integration repairs.

## Local evidence
The isolated real Electron suite passed 2 tests: registration/restart and a
fake executable's read-only App Server discovery, Project assignment and
main-owned Proposal review. The displayed review included the synthetic goal
and criterion. After review the isolated SQLite database had zero Grants and
Attempts, the Project Git worktree remained clean and the fake process was no
longer present. The shared database hash stayed unchanged. The first version of
the process-presence check returned a false failure because PowerShell retained
an implicit error exit for an absent process; an explicit success exit fixed
the check after independently confirming no fake process remained.

Build, lint, typecheck, 9 browser E2E tests, 1115 host unit tests and 50
contract tests passed; 9 unit cases were skipped and are not PASS evidence.
The existing Windows CI invokes this real Electron suite, but the new fake
discovery case has not yet run remotely. No real Codex, sandbox-security,
task execution, H1 acceptance or merge is implied.
