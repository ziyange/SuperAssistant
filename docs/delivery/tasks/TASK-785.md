# TASK-785: Bind local Proposal drafts to a verified Project Git baseline

## Status
APPROVED
PHASE: PHASE-007
MAX_ITERATIONS: 5
user_confirmed: true
Authorization: continue desktop integration and merge-gate remediation; real Codex and Electron sandbox remain deferred.

## Requirement IDs
REQ-006, REQ-022, REQ-026, REQ-031, REQ-094, REQ-095, REQ-099

## Objective
Reject an internal draft whose candidate baseline does not exactly match the committed HEAD at its registered local Project root.

## Context Pack
- docs/delivery/tasks/TASK-783.md
- docs/delivery/tasks/TASK-784.md
- docs/delivery/phase-007-integration-recovery.md

## Must Read
- AGENTS.md
- docs/README.md
- docs/data-model.md
- docs/security.md
- docs/decisions/ADR-004-task-worktrees.md
- docs/verification/quality-gate.md

## Allowed Files
- .github/workflows/docs-gates.yml
- docs/delivery/tasks/TASK-785.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- docs/data-model.md
- docs/security.md
- docs/verification/reports/phase-007-task-785.md
- apps/desktop/src/main/project-git-baseline.ts
- apps/desktop/src/main/proposal-draft-store.ts
- apps/desktop/tests/main/proposal-draft-store.test.ts

## Forbidden Files
All other files; no schema migration, read-only IPC change, application launch, Codex command, user Project mutation, merge or branch deletion.

## Interfaces / Contracts
Draft creation first validates the local catalog and derives the root from the same SQLite snapshot. A bounded shell-free Git read verifies the canonical repository root and resolves HEAD to a full commit ID. A candidate with an absent, abbreviated, malformed or different baseline is rejected. Catalog facts and exact stored path are rechecked inside the existing immediate transaction before inserting. Existing drafts can be read as history; no persisted draft constitutes approval.

## Data Constraints
Do not interpolate user content into Git options. Strip inherited Git overrides, disable system/global config, optional locks, replacement objects, prompting and lazy object fetching. Do not return paths or raw Git errors, change the project or expose this internal check via IPC.

## UI Constraints
None; no renderer changes or new execution paths.

## Implementation Requirements
Read the Project row from trusted local scope before Git. Reject noncanonical or nonroot paths and unusable HEAD. Keep subprocess outside the SQLite writer lock. Preserve immutable historical data; future review and dispatch must recheck current authority and baseline. Do not add model/list to default discovery: the pinned Codex version can fetch over the network and model metadata is not an executable Function.

## Test Requirements
Use disposable real Git repositories and SQLite to exercise committed HEAD, wrong or abbreviated commit ID, advanced HEAD, nonroot and unborn Project, inherited Git overrides and zero Grant or Task effects. Run focused and full unit, contract, build, lint, typecheck and governance gates.

## Acceptance Criteria
Only the exact current full HEAD of the canonically registered Project root can enter a new draft. Invalid or foreign facts cannot create a draft. Nothing makes a draft executable or approves a merge.

## Done Definition
Capture red/green, verify the anchored runtime audit and exact file scope, and record the remaining gaps.

## Risks
This is a point-in-time local Git observation, not executable identity attestation, durable locking, resource fencing or preflight. HEAD may change after observation.

## Output Required
[Verification evidence](../../verification/reports/phase-007-task-785.md)
