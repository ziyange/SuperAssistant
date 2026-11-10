# TASK-740: Emit and verify the Codex Adapter runtime package

## Status
APPROVED
PHASE: PHASE-007
MAX_ITERATIONS: 4
user_confirmed: true
Authorization: user-confirmed continuous PHASE-007 remediation toward merge gates.

## Requirement IDs
REQ-014, REQ-015, REQ-019, REQ-090, REQ-092, REQ-093, REQ-095

## Objective
Make the root production build emit a loadable Codex Adapter ESM package instead of only running its typecheck.

## Context Pack
- docs/adapters/codex.md
- docs/verification/reports/phase-007-task-739.md
- apps/desktop/tests/main/runtime-package.test.ts

## Must Read
- AGENTS.md
- docs/README.md
- docs/requirements.md
- docs/architecture.md
- docs/adapters/codex.md
- docs/verification/quality-gate.md
- package.json
- packages/codex-adapter/package.json
- packages/domain/tsconfig.build.json

## Allowed Files
- docs/delivery/tasks/TASK-740.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- docs/operations.md
- docs/verification/reports/phase-007-task-740.md
- package.json
- packages/codex-adapter/package.json
- packages/codex-adapter/tsconfig.build.json
- apps/desktop/tests/main/runtime-package.test.ts

## Forbidden Files
Do not change dependencies or lockfiles, enable Codex execution, modify sandbox settings, start a real Codex server, change archived evidence or touch user projects.

## Interfaces / Contracts
The package export resolves to emitted dist/index.js at runtime and source types for workspace checking. Root build builds domain before Codex Adapter and emits JS and declarations. Typecheck continues including source and tests; build emits only source.

## Data Constraints
No secrets, external data, network or database changes.

## UI Constraints
No graphical UI changes or IPC connection.

## Implementation Requirements
Document the packaging correction, create a failing Node runtime-import test before changing package build, then add the minimal build config and root build ordering.

## Test Requirements
Run the runtime package test red then green after root build; run lint, root typecheck, full unit and contract suites after build, documentation checks and anchored runtime verification. No Electron sandbox execution.

## Acceptance Criteria
Root build exits 0 and the real Node ESM resolver imports the built supervisor export; adapter source and tests still undergo strict typechecking. No change grants execution capability.

## Done Definition
Record commands, actual outcomes, skipped tests and limits.

## Risks
A typecheck-only package can appear built but fail at runtime. A loadable adapter does not establish protocol compatibility or desktop integration.

## Output Required
docs/verification/reports/phase-007-task-740.md
