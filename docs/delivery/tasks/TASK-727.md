# TASK-727: Isolate DSH probe tests from mutable external checkouts

## Status
APPROVED
PHASE: PHASE-007
MAX_ITERATIONS: 4
user_confirmed: true
Authorization: the user's approved continuous remediation plan authorizes bounded task packs and ordinary decisions without repeated approval.

## Requirement IDs
REQ-090, REQ-096, REQ-099

## Objective
Make deterministic DSH probe tests independent of the user's continuously updated DSH checkout without weakening production compatibility checks.

## Context Pack
- docs/delivery/phase-007-integration-recovery.md
- docs/verification/reports/phase-007-task-721.md

## Must Read
- AGENTS.md
- docs/README.md
- docs/security.md
- docs/operations.md
- packages/dsh-adapter/src/dsh-probe.ts
- packages/dsh-adapter/tests/dsh-probe.test.ts
- docs/verification/quality-gate.md

## Allowed Files
- docs/delivery/tasks/TASK-727.md
- docs/verification/reports/phase-007-task-727.md
- packages/dsh-adapter/tests/dsh-probe.test.ts
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json

## Forbidden Files
Do not change production DSH code, permissions, protocol gates, the external DSH checkout, package locks, archived evidence, unrelated source, or any user-owned worktree.

## Interfaces / Contracts
The existing probe must continue checking the exact configured commit and protocol before spawning its process. A synthetic, temporary Git fixture supplies deterministic repository identity only; fake JSON-RPC processes still exercise success, mismatch, malformed frames, termination, and reaping. Live DSH compatibility remains a separate, unpassed integration gate.

## Data Constraints
Create only disposable test repositories under the operating system temporary directory. Never alter the user's DSH checkout or store credentials.

## UI Constraints
Not applicable: test-fixture-only change.

## Implementation Requirements
Replace the hard-coded live checkout and commit with a newly initialized temporary Git repository and fixture protocol package. Preserve existing behavioral assertions and add proof that an incorrect commit is rejected. Remove only the fixture directory created by the test after its use.

## Test Requirements
Run the existing probe test first to record its failure, then run the revised file under Node 22, targeted lint and the task runtime verifier. Run the complete unit suite where the environment permits and report all failures and skipped tests honestly.

## Acceptance Criteria
All four probe scenarios pass on the isolated fixture, including rejection of a mismatched configured commit and protocol; no live DSH repository is changed and no production gate or capability policy is weakened.

## Done Definition
Target tests and lint pass, the task scope and runtime trace verify, and the report records commands, environment, failures, limitations and the candidate identity. The full unit suite and live DSH conformance are not claimed as passing without evidence.

## Risks
An over-permissive fixture might conceal a live upstream incompatibility; production acceptance must continue to use a separately checked real DSH profile.

## Output Required
docs/verification/reports/phase-007-task-727.md
