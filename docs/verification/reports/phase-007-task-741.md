# TASK-741: Local Proposal and execution authority binding

Candidate: codex/task-720-audited at db83fb9 plus uncommitted remediation changes. Windows; Node 22.19.0, npm 10.7.0; 2026-11-05.

## Scope and evidence

REQ-021/024/025/027/028/030/031/090/094/096. Grant issuance checks caller and persisted canonical Proposal digests, rejects changed-Proposal replay and does not issue new grants at or after expiry or with invalid times. Execution validates Grant digest and Proposal workspace/project/agent/function transactionally. Existing execution-key replays must retain Task, WorkItem, Grant and Lease identity.

- In-memory SQLite red run: 12 failures reproduced wrong-target execution, digest mismatch, replay scope conflicts and forged Proposal acceptance; two existing tests passed.
- The expiry regression failed before its fix. Final focused run: two files, 14 tests passed; assertions include no new Task/Outbox and an unconsumed Grant on rejected execution.
- Root build, lint and workspace typecheck: exit 0. After build, full unit suite: 149 files, 345 passed and 6 skipped, exit 0. Contract suite: 8 files, 35 passed, exit 0. Skips do not constitute acceptance.
- Task Pack, documentation links, REQ matrix, five schemas, anchored runtime trace and git diff --check passed. A security-document patch initially failed because the heading differed; its pre-write hash was unchanged before the same pending action was safely retried.

## Remaining security boundary

The repository methods still accept caller-provided actor/time values, and initial resource selection is not proven to bind a Proposal resource policy. They are not connected to the desktop execution path. Before enabling dispatch, a follow-on task must derive actor and time from trusted control-plane context and validate the initial worktree/resource against the approved policy. This report is not end-to-end authorization, sandbox, real Codex, H1 acceptance or merge evidence.
