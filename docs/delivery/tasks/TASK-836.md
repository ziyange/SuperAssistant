# TASK-836: Render the real desktop application from file URLs

## Status
COMPLETED
PHASE: PHASE-007
MAX_ITERATIONS: 5
user_confirmed: true
Authority: user authorized autonomous fixes to reach the merge gate and real desktop main-process integration, while deferring real Codex and sandbox security validation.

## Requirement IDs
REQ-001, REQ-002, REQ-006, REQ-010, REQ-011, REQ-090, REQ-092, REQ-094, REQ-095

## Objective
Fix the real Electron blank screen reproduced in TASK-835 and complete the isolated Project registration and restart test without renderer API injection.

## Context Pack
- docs/delivery/tasks/TASK-835.md
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
- docs/delivery/tasks/TASK-836.md
- docs/delivery/tasks/TASK-835.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- docs/operations.md
- apps/desktop/vite.config.ts
- apps/desktop/tests/real-desktop/project-registration.spec.ts
- playwright.real-desktop.config.ts
- .github/workflows/application-gates.yml
- apps/desktop/src/main/main.ts
- apps/desktop/src/main/project-ipc.ts
- apps/desktop/src/renderer/App.tsx
- apps/desktop/src/renderer/project-center.tsx

## Forbidden Files
All other repository files, user projects and actual user application data, production credentials, real Codex, Electron sandbox security tests, remote merge and release.

## Interfaces / Contracts
Built renderer assets must resolve relative to the loaded `file://` document without weakening CSP or navigation policy. The test must set a test-owned Electron `userData` path before importing the real main module, use real preload/IPC/SQLite and fake only the native directory selection. Never replace the renderer API. Execution and sandbox-security validation remain unavailable and unclaimed.

## Data Constraints
Only test-owned repository and application-data root. Preserve the shared Electron database from TASK-835 and confirm its hash does not change. No real Codex or credential calls.

## UI Constraints
Existing navigation and Project Center behavior remain intact; no artificial successful task execution.

## Implementation Requirements
Use TASK-835's failing real Electron test as the red regression; correct Vite's renderer asset base, rebuild and run the test through registration and restart. Repair additional directly evidenced integration defects within this exact scope. Add the real-desktop check to Windows CI only when its isolation and local test pass.

## Test Requirements
Run real Electron registration/restart, regular browser E2E, lint, typecheck, build, unit, contract and governance gates. Validate the retained shared-database hash after every desktop launch; do not run sandbox security or real Codex tests.

## Acceptance Criteria
The real desktop displays the built renderer under `file://`, registers one disposable Project via real IPC and displays the same Project after restart using only a temporary profile. The shared database hash remains unchanged. Windows CI runs the same desktop workflow without silent skips.

## Done Definition
Record command output and precise evidence, close TASK-835 only when its conditions pass, and commit. The broader H1 and merge gates remain independent.

## Risks
Electron or native ABI differences can prevent startup; never overwrite user data or weaken security to make the test pass. Fake directory selection does not validate operating-system dialogs or sandbox security.

## Output Required
Relative asset base, genuine desktop integration evidence and non-silent Windows CI wiring.

## Local evidence
TASK-835 first reproduced a blank real Electron window with root-relative Vite
assets. With a relative base, the built desktop rendered and the real Electron
test registered one disposable Git Project and displayed it after restart:
1 passed, no renderer API injection. Its test bootstrap sets `userData` before
application startup and the shared database SHA-256 stayed unchanged on each
subsequent run. The directory dialog is a fixture; no sandbox security or real
Codex operation was tested.

Local browser E2E: 9 passed. Lint, typecheck, build, full host unit (1115
passed, 9 skipped) and contract (50 passed) succeeded. Skips are not PASS
evidence. On candidate commit `f272b0e7776b54cb4f51e625ab1d44b36703ec6d`,
the [GitHub application workflow](https://github.com/ziyange/SuperAssistant/actions/runs/45233104163)
passed Windows build, the real desktop test, lint, typecheck, unit and contract
gates, and the PostgreSQL 16 job. The [documentation workflow](https://github.com/ziyange/SuperAssistant/actions/runs/45233104148)
also passed. This evidence is for the cited commit; later code changes require
fresh CI. These results do not establish H1 or authorize merge.
