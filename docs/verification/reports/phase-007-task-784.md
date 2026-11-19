# PHASE-007 TASK-784: Desktop Proposal preparation

Bounded evidence for [TASK-784](../../delivery/tasks/TASK-784.md).
Baseline: `dd2deb3`; the `task-784-*` audit scope identifies this patch.
Windows; Node 22.19.0, npm 10.7.0, Python 3.9.12, Git 2.55.0.windows.3.

The home screen now selects a registered active Project and displays an
authoritative local prerequisite observation through the production
preload, trusted sender check, request schema and SQLite query. The read
returns only an enum; it does not create a draft, ProposalVersion, Grant,
Task or Attempt. A matching catalog still requires live verification.

The two new regression tests were first red for the missing channel and
component. After implementing them, the SQLite test verified no writes
and rejected foreign, paused and absent Projects, ambiguous or locked
Workspaces, and malformed requests. It checked registered default Codex,
Function state and unavailable storage. The renderer test switched
Projects while a prior request was pending and rejected the old result;
error copy did not expose internal details. Explicit test cleanup and
the deferred callback type fixed test-fixture defects without changing
production behavior.

Commands were run in the candidate worktree. The production workspace
build steps, including desktop main, preload and renderer, passed.
`npm run lint` and the `npm run typecheck --workspaces --if-present`
implementation passed (using npm 10.7.0 directly for the workspace
typecheck). Focused Vitest passed 5 tests across both changed files.
`vitest run --project unit --maxWorkers=1 --reporter=dot` and the
corresponding `--project contract` run: 540 passed across 156 unit files, six PostgreSQL-dependent skips,
and 49 passed across eight contract files; no failures.
`playwright test` passed all 8 browser fixtures. Those tests do not run
the Electron main process or prove sandbox/preload operation at runtime.

Governance preflight passed (331 documents, 131 packs, traceability, five
schemas, runtime Exit 0, 34 Python tests, and an exact path comparison).
This report is followed by the same ordered governance gate for the final
patch. Candidate GitHub Actions are independent evidence once run.

No user projects were modified. Saved Codex registration does not create
verified Function capabilities; that integration, live baseline and
permission revalidation, immutable review, execution and recovery are
still open. Real Codex, real Electron sandbox, and local PostgreSQL
integration were not run here. This task is not H1/M1, phase or main
merge acceptance.
