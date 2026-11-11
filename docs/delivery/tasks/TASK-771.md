# TASK-771: Compare canonical worktree paths in safety test

## Status
APPROVED
PHASE: PHASE-007
MAX_ITERATIONS: 3
user_confirmed: true
Authorization: user authorized remediation of development-baseline merge blockers.

## Requirement IDs
REQ-090, REQ-092, REQ-093, REQ-098

## Objective
Repair the Windows CI safety test that compares an 8.3 path with its long-path alias. Preserve its assertions that untracked evidence and the registered worktree survive failure.

## Context Pack
- docs/verification/reports/phase-007-task-770.md
- docs/verification/quality-gate.md

## Must Read
- AGENTS.md
- docs/README.md
- docs/requirements.md
- docs/architecture.md
- docs/security.md
- docs/verification/quality-gate.md
- docs/delivery/tasks/TASK-770.md

## Allowed Files
- docs/delivery/tasks/TASK-771.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- apps/desktop/tests/main/worktree-service.test.ts
- .github/workflows/docs-gates.yml
- docs/verification/reports/phase-007-task-771.md

## Forbidden Files
Application sources, source evidence, archived evidence, user workspaces and TASK-716 WIP. No real Codex, Electron sandbox, merge or cleanup.

## Interfaces / Contracts
Compare actual canonical filesystem identities for each Git-registered worktree, accounting for Windows case insensitivity; do not weaken assertions or remove test coverage. Anchor documentation CI to this task.

## Data Constraints
Tests operate solely on their own disposable repository and preserve real user files.

## UI Constraints
No UI changes.

## Implementation Requirements
Parse worktree registrations and canonicalize both observed and expected paths. Keep evidence content and original project assertions unchanged. Rerun the targeted test and candidate CI.

## Test Requirements
Run affected worktree tests, complete governance and candidate CI without silently skipping tests.

## Acceptance Criteria
Windows short and long path aliases identify the same registered worktree, but unrelated paths do not. Existing failure-preservation assertions pass.

## Done Definition
Record CI failure, fix and new evidence; do not claim unrun CI passed.

## Risks
String normalization alone cannot resolve 8.3 aliases; use filesystem canonicalization and avoid prefix matching.

## Output Required
docs/verification/reports/phase-007-task-771.md
