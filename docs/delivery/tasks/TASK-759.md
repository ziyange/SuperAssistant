# TASK-759: Record migration task gate sequencing discrepancy

## Status
APPROVED
PHASE: PHASE-007
MAX_ITERATIONS: 3
user_confirmed: true
Authorization: approved governance remediation and standing user authorization for in-scope corrections.

## Requirement IDs
REQ-090, REQ-091, REQ-092, REQ-096, REQ-099

## Objective
Preserve the fact that TASK-757's structural and scope checks were performed after implementation, not before, and record the actual retrospective evidence without rewriting history.

## Context Pack
- docs/delivery/tasks/TASK-757.md
- docs/verification/reports/phase-007-task-757.md
- docs/delivery/permission-audit.log

## Must Read
- AGENTS.md
- docs/README.md
- docs/security.md
- docs/verification/quality-gate.md
- docs/delivery/tasks/TASK-757.md

## Allowed Files
- docs/delivery/tasks/TASK-759.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- docs/verification/reports/phase-007-task-757.md
- docs/verification/reports/phase-007-task-759.md

## Forbidden Files
No application code, archived evidence, user databases, credentials, real Codex, Electron sandbox, remote operations or Git integration.

## Interfaces / Contracts
Do not claim a retrospective check ran before implementation. Compare original Task Pack hash to its audited creation hash; compare every TASK-757 FILE_WRITE path with that original allowlist; record results and limitations separately from current runtime gate.

## Data Constraints
Read-only inspection of audit records and working files except the explicitly allowed active reports.

## UI Constraints
No UI change.

## Implementation Requirements
Record the timing error, the existing Task Pack hash match, retrospective structural validation and path comparison. Do not fabricate a clean global working-tree boundary.

## Test Requirements
Run Task Pack structure check, audit path comparison, current anchored goal runtime trace, documentation links and git diff --check.

## Acceptance Criteria
The report explicitly identifies the missing pre-implementation gate, the exact retrospective checks and whether any path was out of scope; no historical evidence is silently rewritten.

## Done Definition
Record the discrepancy and retain clean-SHA and full-system gates as open.

## Risks
Retrospective checks do not prove the missed gate was performed in the correct order and do not replace an independent final file-boundary audit.

## Output Required
docs/verification/reports/phase-007-task-759.md
