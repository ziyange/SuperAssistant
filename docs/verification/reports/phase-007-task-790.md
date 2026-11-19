# TASK-790 — Original Attempt receipt and desktop recheck

Candidate patch from `45770ff011034da62f77cbcde92b6d285517ee77` on Windows.
The live remote main remained `8b9f7101b3703c9613c6427f413c81ff548972d0`.
Scoped to REQ-029/037/049 and safeguards in [TASK-790](../../delivery/tasks/TASK-790.md).
No change to either retained worktree (30 and 15 dirty paths).

**Verified locally:** additive migration 025; atomic current-claim receipt, start acknowledgement
and transition to RUNNING; an actual close/reopen of SQLite; reconciliation during the official
explicit Codex check after restart, on the authenticated read-only supervisor. Same registered
path, binary hash, version, stored Grant/digest, Work Item, Thread, Turn and exact worktree
are required. Unrecognized accounts, newer resume deliveries and workspace changes do not
resolve uncertainty. This does not issue a Grant, dispatch, release the lease, or accept the Task.
No renderer can submit a receipt. The dispatch-side recorder is private and not yet reached
by a production execution worker: existing or fixture-only attempts are not backfilled.

Red observations: before the change a response for another worktree returned COMPLETED;
additional tests caught an unrecognized account changing UNKNOWN to FAILED and a later
resume message being ignored. Green tests used SQLite, typed desktop reconnect and a
controlled JSONL upstream. Upstream reference: [pinned App Server protocol](https://github.com/openai/codex/blob/rust-v0.121.0/codex-rs/app-server/README.md).

Executed in the isolated candidate on 2026-11-19: production build, ESLint and workspace
typecheck (exit 0); Node 22.19.0, npm entry 10.9.3 (nested npm emitted a version warning).
Vitest unit: 160 files, 560 passed, six PostgreSQL environment skips. Contract: eight
files, 50 passed, no skips. Governance: all Task Packs, 99 REQs, five schemas, nonempty
Markdown scan, Plan trace exit 0, 34 Python tests, git diff and exact changed-file hashes.
Final governance is repeated after adding this record. No remote CI, real Codex or
Electron sandbox run for this candidate.

**Integration not accepted:** the official dispatch/confirmation writer and owned-process
active cancellation remain open. Separately, source review found the old Task list/detail
projection treats a SUCCEEDED Attempt as a COMPLETED Task even without acceptance.
This is an outstanding display defect, not evidence that the business Task completed.
