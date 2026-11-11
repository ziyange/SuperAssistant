# TASK-772: Require an explicit outbox dispatch guard

## Status
APPROVED
PHASE: PHASE-007
MAX_ITERATIONS: 5
user_confirmed: true
Authorization: user requested autonomous remediation of merge-blocking security issues.

## Requirement IDs
REQ-027, REQ-030, REQ-031, REQ-038, REQ-090, REQ-091, REQ-095, REQ-098

## Objective
Make the currently unwired dispatcher fail closed without an explicit per-message authorization guard, for both start and resume. This is a defense-in-depth boundary, not production execution wiring or proof of live authorization.

## Context Pack
- docs/verification/reports/phase-007-task-765.md
- docs/verification/reports/phase-007-task-771.md
- docs/orchestration.md

## Must Read
- AGENTS.md
- docs/README.md
- docs/requirements.md
- docs/architecture.md
- docs/data-model.md
- docs/security.md
- docs/orchestration.md
- docs/operations.md
- docs/verification/quality-gate.md
- docs/delivery/tasks/TASK-765.md

## Allowed Files
- docs/delivery/tasks/TASK-772.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- docs/orchestration.md
- apps/desktop/src/main/outbox-dispatcher.ts
- apps/desktop/tests/main/orchestrator.test.ts
- packages/persistence/tests/outbox-inbox.test.ts
- .github/workflows/docs-gates.yml
- docs/verification/reports/phase-007-task-772.md

## Forbidden Files
No production startup wiring, real adapter execution, user database, user project, Electron sandbox, source evidence, archived evidence, dirty external worktrees, merge or branch cleanup.

## Interfaces / Contracts
OutboxDispatcher must refuse before claiming if the guard is absent. After a claim it calls a supplied guard with the complete claimed message immediately before invoking an adapter. Only literal true authorizes dispatch. Guard refusal or exception invokes claim-fenced markUncertain and never starts, resumes or acknowledges. Guards in existing tests are explicit test fixtures, not production authorization implementations. Resume follows the same guard as start.

## Data Constraints
Use disposable SQLite fixtures and fake adapters. A rejected claimed message is quarantined and is never automatically retried.

## UI Constraints
No UI changes; execution remains unavailable in production startup.

## Implementation Requirements
Record the guard boundary in orchestration first. Write and observe failing guard-absence, denial, exception and resume tests before implementation. Preserve outbox and unknown-result safeguards. No production trust is assigned to a test guard.

## Test Requirements
Run targeted dispatcher and SQLite tests, typecheck, lint, production build, full unit and contract suites, ordered governance and anchored runtime verification. Rerun candidate CI.

## Acceptance Criteria
Missing guard makes no claim or external call. False, non-true or throwing guard never invokes the adapter or acknowledgement and retains uncertain claim evidence. A true guard sees the exact claimed message and existing dispatch behavior remains intact. This alone does not enable execution or satisfy live authorization, fencing or recovery gates.

## Done Definition
Record RED and GREEN evidence, limitations and current CI status without claiming full integration or merge readiness.

## Risks
An arbitrary injected guard is not proof of correct authorization, lease freshness, ownership or per-write fencing; wiring remains blocked on those independent contracts and tests.

## Output Required
docs/verification/reports/phase-007-task-772.md
