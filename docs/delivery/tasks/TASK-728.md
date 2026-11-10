# TASK-728: Repair TypeScript lint false positives without weakening unused-variable checks

## Status
APPROVED
PHASE: PHASE-007
MAX_ITERATIONS: 4
user_confirmed: true
Authorization: user-approved continuous remediation, including autonomous ordinary scoped changes.

## Requirement IDs
REQ-090, REQ-096, REQ-099

## Objective
Restore the full repository lint gate while retaining effective unused-variable detection and avoiding production behavior changes.

## Context Pack
- docs/delivery/phase-007-integration-recovery.md
- docs/verification/reports/phase-007-task-727.md

## Must Read
- AGENTS.md
- docs/README.md
- docs/verification/quality-gate.md
- eslint.config.mjs

## Allowed Files
- docs/delivery/tasks/TASK-728.md
- docs/verification/reports/phase-007-task-728.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- eslint.config.mjs

## Forbidden Files
Do not change application logic, permissions, package lockfiles, archived evidence, unrelated user worktrees, or disable TypeScript unused-variable enforcement.

## Interfaces / Contracts
No production interface changes. ESLint must still reject a genuinely unused variable in each affected TypeScript configuration; the JavaScript base rule remains enabled outside the narrowly identified files.

## Data Constraints
No data migration, credentials, or external system mutation.

## UI Constraints
Not applicable: lint configuration only.

## Implementation Requirements
Address the twelve base no-unused-vars false positives on TypeScript-only interface and parameter-property declarations in five identified files. Keep the TypeScript-aware unused-variable rule enabled and avoid broad suppression or changes to application source.

## Test Requirements
Run full lint before and after the change. Exercise ESLint on synthetic TypeScript through stdin to prove a genuinely unused local is rejected in affected files and that valid interface arguments are not flagged. Re-run task runtime verification, task pack validation and git diff checks.

## Acceptance Criteria
Full lint exits 0 without warnings. Synthetic unused locals fail with the TypeScript-aware rule and valid type-only arguments pass. No production source or rule for unrelated files is changed.

## Done Definition
Evidence records commands, counts, exit codes and current candidate identity; task pack and runtime checks pass. This task alone does not establish M1 acceptance.

## Risks
A lint override could conceal genuine unused variables. Limit it to five exact paths and independently verify the TypeScript rule remains active.

## Output Required
docs/verification/reports/phase-007-task-728.md
