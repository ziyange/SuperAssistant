# TASK-730: Preserve dirty worktrees on failed task creation

## Status
APPROVED
PHASE: PHASE-007
MAX_ITERATIONS: 4
user_confirmed: true
Authorization: user-approved continuous M1 safety remediation.

## Requirement IDs
REQ-090, REQ-095, REQ-098, REQ-099

## Objective
Prevent the failed Git worktree creation path from forcibly deleting a dirty worktree or files created during setup.

## Context Pack
- docs/delivery/phase-007-integration-recovery.md
- docs/security.md

## Must Read
- AGENTS.md
- docs/README.md
- docs/security.md
- docs/operations.md
- apps/desktop/src/main/worktree-service.ts
- apps/desktop/tests/main/worktree-service.test.ts
- docs/verification/quality-gate.md

## Allowed Files
- docs/delivery/tasks/TASK-730.md
- docs/verification/reports/phase-007-task-730.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- apps/desktop/src/main/worktree-service.ts
- apps/desktop/tests/main/worktree-service.test.ts

## Forbidden Files
Do not modify unrelated worktrees, user repositories, Git metadata outside disposable test repositories, sandbox settings, archived evidence, or application policy.

## Interfaces / Contracts
The existing WorktreeService API remains unchanged. Failed creation may clean an unmodified new worktree with ordinary Git removal; dirty or ambiguous worktrees must remain intact and be available for inspection. Never pass Git's force-removal flag.

## Data Constraints
Use only uniquely created temporary test repositories. A failed operation must not erase untracked or modified files in the newly created worktree.

## UI Constraints
No UI changes.

## Implementation Requirements
Reproduce the failure using a disposable real Git repository and a setup hook that creates an untracked sentinel before a deliberate branch-name conflict. Replace forced cleanup with safe Git removal and preserve the original failure.

## Test Requirements
Run the new failure scenario before and after the fix; verify the sentinel survives and the original repository stays unchanged. Run existing worktree tests, targeted lint, typecheck, full unit regression and runtime checks.

## Acceptance Criteria
Dirty failed-creation worktrees retain their sentinel and Git registration; clean failures are removable without force; successful task worktrees still remain isolated.

## Done Definition
Focused and regression evidence and limitations are recorded, with a valid runtime trace and unchanged user repositories.

## Risks
Preserving ambiguous worktrees consumes disk space; preserving user data has priority over automatic cleanup.

## Output Required
docs/verification/reports/phase-007-task-730.md
