# TASK-776: Discover Git Project metadata without mutation

## Status
APPROVED
PHASE: PHASE-007
MAX_ITERATIONS: 5
user_confirmed: true
Authorization: user requested autonomous resolution of the integration blockers.

## Requirement IDs
REQ-006, REQ-007, REQ-090, REQ-091, REQ-094, REQ-095, REQ-098

## Objective
Complete read-only Git metadata discovery during Project registration and show safe repository identity and evidenced default branch in the existing Project cards. Non-Git directories remain registerable.

## Context Pack
- docs/architecture.md
- docs/requirements.md
- docs/ux.md
- apps/desktop/src/main/project-ipc.ts

## Must Read
- AGENTS.md
- docs/README.md
- docs/product.md
- docs/requirements.md
- docs/architecture.md
- docs/data-model.md
- docs/security.md
- docs/ux.md
- docs/operations.md
- docs/verification/quality-gate.md

## Allowed Files
- docs/delivery/tasks/TASK-776.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- docs/architecture.md
- docs/ux.md
- apps/desktop/src/main/project-ipc.ts
- apps/desktop/tests/main/project-ipc.test.ts
- .github/workflows/docs-gates.yml
- docs/verification/reports/phase-007-task-776.md

## Forbidden Files
No Project writes, Git network operations, Git configuration modification, arbitrary shell command, executable dispatch, credentials, user worktree mutation, Electron sandbox, source evidence, archived evidence, merge or branch cleanup.

## Interfaces / Contracts
Use bounded read-only Git commands with argument arrays and no shell, suppress terminal prompts and inherited Git redirection/config environment. Discover only a sanitized repository basename and an explicitly evidenced origin default branch from its local symbolic ref; do not treat the currently checked-out branch as the default. If Git is unavailable, the directory is not a Git worktree, metadata is malformed or discovery fails, retain null metadata and allow Project registration. Renderer gets only sanitized card values, not absolute paths or remote URLs. Discovery is not execution preflight or proof of a clean baseline.

## Data Constraints
Persist only safe discovered display metadata via the existing SQLite repository. Never store remote URLs or credentials from Git. Preserve existing rows and canonical Project deduplication.

## UI Constraints
Reuse the existing Project card display; no layout change. Show discovered safe values and existing unavailable labels when unknown.

## Implementation Requirements
Update engineering and UX facts before coding. Write RED integration tests with disposable Git and non-Git directories, checking database reopen, safe output and unchanged original files. Validate Git output boundaries and clean inherited Git overrides.

## Test Requirements
Run targeted Project tests, lint, typecheck, build, full unit and contract suites, ordered governance and candidate CI. Use only disposable Git fixtures.

## Acceptance Criteria
An identified Git root and locally evidenced origin default branch survive SQLite reopen and display without paths or secrets. A non-Git Project still registers with unavailable metadata. Failed Git discovery does not mutate or reject an otherwise valid Project.

## Done Definition
Record actual tests and limits; user editing, Agent association, trusted execution snapshot and end-to-end execution remain open.

## Risks
Git output is untrusted; repository paths, remote URLs and control characters must not leak to Renderer. Default branch must never be guessed from current checkout.

## Output Required
docs/verification/reports/phase-007-task-776.md
