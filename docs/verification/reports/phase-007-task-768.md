# TASK-768 — Development-baseline candidate preparation

Status: IN PROGRESS. This file records pre-commit evidence; it is not a
clean-SHA or remote-CI acceptance report.

On 2026-11-10, the remote main branch resolved to
`5d107037583f870ec38c36162313d08f35948e84`, also the local main. The
candidate base `db83fb926269a66fea1bb3c1332c9b9c5e6526b9` contains
main and is 86 commits ahead. The main workspace has five untracked files;
none overlap candidate committed or working paths. They remain untouched.

The independently preserved TASK-716 worktree has 30 paths whose SHA-256
values still match the recorded baseline. Its WIP is not accepted as a
complete notification flow and must not be deleted or silently overwritten.
Before this task, 188 changed candidate files matched their latest audit
hashes and two audit/trace files were validated by the runtime chain; zero
unmatched or missing paths were observed. This provenance check is not a
substitute for independent semantic review or final staged-diff review.

Local evidence before candidate staging is recorded in TASK-766 and TASK-767:
the exact local-file navigation regression is fixed; application build,
lint, typecheck, 478 unit tests, 49 contract tests and 13 isolated PostgreSQL
16.4 cases passed. Six unit cases were skipped in the standard run and
executed separately against the disposable database. The summary checker
rejects unexpected skips or zero tests. Real Electron sandbox and real Codex
were deliberately deferred, not passed. PostgreSQL 17 remains an H3 gate.

The existing documentation CI's TASK-000 scope returned Exit 2 on subsequent
history; TASK-767 introduced an anchored check. This task updates the anchor
again to its own pack while retaining full audit-chain validation. Future
tasks must update that anchor within their approved scope.

Candidate commit, independent clean-SHA rerun and remote application and
documentation CI on the candidate SHA remain REQUIRED. This record does not
authorize a release or claim H1, M1, H3 or PHASE-007 acceptance.
