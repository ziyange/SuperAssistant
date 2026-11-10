# TASK-763: Bind outbox commands to Attempt lifecycle and Decision evidence

## Status
APPROVED
PHASE: PHASE-007
MAX_ITERATIONS: 5
user_confirmed: true
Authorization: standing authorization for PHASE-007 execution integration remediation.

## Requirement IDs
REQ-030, REQ-038, REQ-040, REQ-043, REQ-049, REQ-092, REQ-093, REQ-097, REQ-099

## Objective
Block invalid lifecycle states and forged Decision resolutions before a claimed internal outbox message reaches the fake dispatcher.

## Context Pack
- docs/verification/reports/phase-007-task-761.md
- docs/verification/reports/phase-007-task-762.md
- packages/persistence/src/repositories/outbox-repository.ts
- packages/persistence/src/repositories/decision-repository.ts

## Must Read
- AGENTS.md
- docs/README.md
- docs/requirements.md
- docs/data-model.md
- docs/security.md
- docs/orchestration.md
- docs/api/sai.md
- docs/verification/quality-gate.md
- docs/delivery/tasks/TASK-762.md

## Allowed Files
- docs/delivery/tasks/TASK-763.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- docs/orchestration.md
- docs/security.md
- docs/verification/reports/phase-007-task-763.md
- packages/persistence/src/repositories/outbox-repository.ts
- packages/persistence/tests/outbox-inbox.test.ts

## Forbidden Files
No production dispatch wiring, real Codex or DSH execution, user projects or databases, Electron sandbox, credentials, archive, remote operations or Git integration.

## Interfaces / Contracts
At claim time start is eligible only for DISPATCH_PENDING and resume only for WAITING_USER or WAITING_INPUT. Known commands with any other state are quarantined without changing their Attempt. Unknown kinds remain subject to the existing malformed-message quarantine. A resume must reference a RESOLVED Decision with the exact resolution identifier and the claimed Attempt's WorkItem; mismatch is quarantined. The NOT_STARTED terminal state must remain unchanged during uncertain and interrupted-claim recovery. Claim fencing remains intact.

## Data Constraints
Use isolated in-memory SQLite and fake adapters only. No new schema migrations or automatic retries. The claim-time checks do not fence state or authority changes after claim.

## UI Constraints
No UI changes.

## Implementation Requirements
Synchronize engineering facts first. Test invalid lifecycle values including terminal and unknown states, valid start and authentic resolved resume, mismatched Decision or resolution, and terminal recovery. Verify pre-existing concurrent claim and malformed-message tests remain effective.

## Test Requirements
Run targeted tests red then green, production build, lint, typecheck, full unit and contract suites, governance and anchored goal runtime. Report skips and remaining gaps.

## Acceptance Criteria
No invalid-state or forged-resolution fake dispatch occurs; valid Decision resume is delivered once; NOT_STARTED remains terminal during recovery; no live Adapter is connected.

## Done Definition
Record evidence and keep post-claim concurrency, authorization revalidation, full SAI, real Codex, clean-SHA and merge acceptance open.

## Risks
Claim-time validation cannot ensure execution authority remains valid when a later external effect occurs; production dispatch remains disabled.

## Output Required
docs/verification/reports/phase-007-task-763.md
