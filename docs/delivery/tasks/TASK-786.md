# TASK-786: Pin isolated task worktrees to the reviewed Git commit

## Status
APPROVED
PHASE: PHASE-007
MAX_ITERATIONS: 5
user_confirmed: true
Authorization: the user explicitly requested this baseline gate, followed by trusted Function, Proposal confirmation and recovery; real Codex and Electron sandbox validation are deferred.

## Requirement IDs
REQ-006, REQ-026, REQ-031, REQ-094, REQ-095, REQ-099

## Objective
A Task worktree is created only from the exact approved full commit and returns ACTIVE only while both Project and Task HEAD match that commit at setup completion.

## Context Pack
- docs/delivery/tasks/TASK-785.md
- docs/delivery/phase-007-integration-recovery.md

## Must Read
- AGENTS.md
- docs/README.md
- docs/requirements.md
- docs/orchestration.md
- docs/security.md
- docs/decisions/ADR-004-task-worktrees.md
- docs/verification/quality-gate.md

## Allowed Files
- .github/workflows/docs-gates.yml
- apps/desktop/src/main/project-git-baseline.ts
- apps/desktop/src/main/worktree-service.ts
- apps/desktop/tests/main/worktree-service.test.ts
- docs/delivery/execution-trace.json
- docs/delivery/permission-audit.log
- docs/delivery/tasks/TASK-786.md
- docs/orchestration.md
- docs/security.md
- docs/verification/reports/phase-007-task-786.md
- packages/domain/src/ports/worktree-service.ts

## Forbidden Files
All other files; no production IPC, authorization command, real Codex, Electron sandbox, user repository checkout, or merge.

## Interfaces / Contracts
The main-process WorktreeService port requires baselineCommit as a full lowercase SHA-1 or SHA-256 from stored approved authority, not current renderer input. A malformed commit, unavailable Project HEAD or changed baseline fails before destination creation. The add command uses the exact approved object, not HEAD. The service checks source and checkout HEAD after setup; drift never returns ACTIVE. Cleanup is nonforced for a worktree created by this call; dirty or ambiguous evidence remains.

## Data Constraints
Use the canonical registered root and sanitized Git environment already used for baseline reads. Approval identity, policy and Lease fencing remain the caller's responsibility. No new persistent state.

## UI Constraints
None; no renderer or preload surface is added.

## Implementation Requirements
Reuse TASK-785 local Git inspection. Keep explicit argument arrays. Do not retry against a newer HEAD. Preserve prior dirty-worktree behavior.

## Test Requirements
Use disposable repositories to prove an exact approved checkout, stale commit before mutation, invalid/missing hash, source HEAD moving during setup, and clean versus dirty setup cleanup. Run focused and full local checks and verify candidate CI.

## Acceptance Criteria
No branch or destination is created for a stale/missing baseline before setup; a mid-setup drift cannot return an ACTIVE worktree; the successful branch starts at the reviewed commit.

## Done Definition
Record the red/green evidence, full checks and exact audited scope. Do not treat this internal port or deferred runtime evidence as H1/M1 merge acceptance.

## Risks
This does not make Git and SQLite atomic or prevent HEAD from changing after the observation. Actual dispatch requires fresh authority and Lease checks. Repository checkout configuration and hooks remain an independent runtime boundary.

## Output Required
[Verification evidence](../../verification/reports/phase-007-task-786.md)
