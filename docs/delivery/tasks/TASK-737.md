# TASK-737: Synchronize active integration status and task registry

## Status
APPROVED
PHASE: PHASE-007
MAX_ITERATIONS: 2
user_confirmed: true
Authorization: user-approved continuous document-first integration remediation.

## Requirement IDs
REQ-090, REQ-096, REQ-099

## Objective
Replace stale claims that TASK-721 is unopened with an evidence-backed account of the current uncommitted integration candidate and remaining acceptance gaps.

## Context Pack
- docs/delivery/integration-recovery-baseline.md
- docs/verification/reports/phase-007-task-721.md
- docs/verification/reports/phase-007-task-733.md
- docs/verification/reports/phase-007-task-735.md
- docs/verification/reports/phase-007-task-736.md

## Must Read
- AGENTS.md
- docs/README.md
- docs/delivery/tasks/README.md
- docs/verification/quality-gate.md

## Allowed Files
- docs/delivery/tasks/TASK-737.md
- docs/verification/reports/phase-007-task-737.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- AGENTS.md
- docs/README.md
- docs/delivery/tasks/README.md

## Forbidden Files
Do not modify historical archive evidence, TASK-716 worktree, source documents, code, user projects, Git history or dependency files.

## Interfaces / Contracts
No application interfaces change. Current facts must distinguish local test evidence, uncommitted work, unrun deferred tests, and unaccepted M1/H1/H3.

## Data Constraints
Preserve existing permission and safety rules, immutable baseline records, and all uncommitted user work.

## UI Constraints
Not applicable: documentation-only correction.

## Implementation Requirements
Update only current lifecycle summary and registry entries; retain historical statuses and user safety instructions. Link to current reports and make the known fake-versus-real Codex limitation visible.

## Test Requirements
Run documentation link, task-pack, traceability, schema, runtime and Git diff checks. No application test is required for wording-only changes.

## Acceptance Criteria
No active index claims TASK-721 is unopened; it states TASK-721 is in progress, changes remain uncommitted, sandbox verification is deferred, and M1/H1/H3 are not accepted.

## Done Definition
All affected documentation and runtime checks pass with a report listing commands and any unresolved scope or acceptance limits.

## Risks
Overstating prior work could cause unsafe merge or overwrite dirty worktrees; report facts and limitations explicitly.

## Output Required
docs/verification/reports/phase-007-task-737.md
