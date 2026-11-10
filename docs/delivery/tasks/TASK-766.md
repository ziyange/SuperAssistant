# TASK-766: Restrict desktop navigation to the trusted application document

## Status
APPROVED
PHASE: PHASE-007
MAX_ITERATIONS: 4
user_confirmed: true
Authorization: user authorized orphan-lock recovery and development-baseline merge blocker remediation.

## Requirement IDs
REQ-090, REQ-093, REQ-094, REQ-095, REQ-099

## Objective
Reject navigation from the desktop application to arbitrary local file URLs while preserving the exact trusted application document and existing secure IPC boundary.

## Context Pack
- apps/desktop/src/main/window-policy.ts
- apps/desktop/src/main/main.ts
- apps/desktop/tests/main/window-policy.test.ts
- docs/verification/reports/phase-007-task-721.md

## Must Read
- AGENTS.md
- docs/README.md
- docs/requirements.md
- docs/architecture.md
- docs/security.md
- docs/verification/quality-gate.md
- docs/delivery/tasks/TASK-721.md

## Allowed Files
- docs/delivery/tasks/TASK-766.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- docs/security.md
- docs/verification/reports/phase-007-task-766.md
- apps/desktop/src/main/window-policy.ts
- apps/desktop/src/main/main.ts
- apps/desktop/tests/main/window-policy.test.ts

## Forbidden Files
No sandbox weakening, preload permission expansion, real Electron sandbox validation, real Codex execution, user data, other worktrees, archived evidence or remote operations.

## Interfaces / Contracts
Production always loads the bundled renderer file and both navigation handlers validate against its exact URL. For file URLs, only that exact URL is permitted; other paths, hosts, queries and fragments fail closed. Existing HTTP origin behavior remains testable but the production loadFile path does not use an untrusted environment override.

## Data Constraints
No user files or credentials are opened. Test URL strings are synthetic.

## UI Constraints
No graphical layout or interaction redesign; only attempted navigation policy changes.

## Implementation Requirements
Record the contract first. Demonstrate the arbitrary-file bug in a failing test, then fix both navigation registration sites and the shared policy. Preserve exact IPC sender checks and context isolation.

## Test Requirements
Run focused RED and GREEN window-policy tests, build, lint, typecheck, full unit and contract suites, ordered governance and anchored runtime trace. Electron sandbox testing remains deferred.

## Acceptance Criteria
Exact application file passes; another local file, encoded alternate path, host, query, fragment and external URL fail. HTTP same-origin tests and exact IPC negative tests pass. Both production event handlers use the exact renderer URL.

## Done Definition
Record actual commands, omissions and clean-SHA limitations; this task alone does not accept M1 or authorize release.

## Risks
Static or unit tests do not prove actual Electron event integration. Real sandbox and preload validation remain required before release.

## Output Required
docs/verification/reports/phase-007-task-766.md
