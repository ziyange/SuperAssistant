# TASK-789 verification — retained worktree intake and desktop safeguards

Base: `8b9f7101b3703c9613c6427f413c81ff548972d0`. Local `main` matched the
observed GitHub `main` before the isolated branch was created.

| Worktree | Compared paths | Disposition |
|---|---:|---|
| TASK-720 governance | 15 | Six exact matches excluding CRLF; the other nine change current instructions, evidence or append-only logs, or remove the task-scoped trace anchor and its regression tests. No replay. |
| TASK-716 notifications | 30 | Main already carries the hardened outbox, claim fencing, delivery reconciliation and deep-link checks. The older outbox can acknowledge without the current claim. The missing worker, preferences and UI depend on older contracts or unavailable Team transport; historic fixture passes do not verify safe integration into this SHA. No direct replay; retain for a focused port of preferences and delivery on hardened contracts. |

The review compared staged, unstaged and non-ignored untracked paths against
current main, then checked security-sensitive differences. No retained tree
was staged, changed, installed into or deleted.

### What is verified in this slice

- The desktop Task Center uses a typed preload route and the trusted main
  sender gate. SQLite proves the local Task has one unclaimed start and a
  consistent Project lease. Main displays the database Project, Goal and Task
  ID in the native prompt, then repeats every check in the writer transaction.
  A claimed or re-scoped start, an upstream binding, or stale canonical/legacy
  fencing leaves all rows unchanged. A lease write failure rolls back the
  Outbox, Attempt, WorkItem and Task changes. The UI retains confirmed
  cancellation when navigating or receiving a late older task projection.
- The authenticated 0.121.0 observer reads only the exact original Thread and
  its Turns. Wrong IDs, duplicate matches, active or interrupted results,
  or malformed identifiers do not provide terminal confirmation. This port
  is not wired into production startup, does not redispatch or interrupt,
  and cannot prove process termination or release a Lease.
- A claimed but not yet acknowledged attempt can temporarily look queued;
  main refuses withdrawal before showing a dialog. A dedicated claim-aware
  projection belongs with the active worker integration.

### Evidence

Windows Node 22.19.0 / npm 10.7.0; `npm ci --no-audit --no-fund` used the
unchanged lockfile, with Electron binary download disabled. All commands ran
in the isolated TASK-789 worktree. Production builds for domain, persistence,
Codex adapter, desktop main/preload/renderer and Team Service finished;
final lint and workspace typecheck passed. The initial missing-route and
missing-observer tests failed as expected. Analysis of the follow-up failures
separated the Node SQLite and jsdom renderer environments. Three independent
review regressions then reproduced stale fencing and the old-navigation
projection before all 21 targeted desktop tests passed. A typecheck found an
incorrect transport test-double cast; the final run used an actual unspawned
ChildProcess with synthetic framing streams.

Full Vitest unit: 159 files, 554 passed, six PostgreSQL environment-dependent
skips. Contract: eight files, 50 passed, no skips. Independent read-only review
rechecked the three important findings after repair. Initial local governance
on this slice checked 341 Markdown files, 136 Task Packs, all five schemas,
REQ traceability, Plan trace Exit 0 and 34 Python tests. The final gate is
repeated after report writeback; no candidate GitHub CI has been run.

### Full desktop closure still open

No production confirmation or live start route was enabled. Next bind a
trusted executable Function and native confirmation to the complete reviewed
digest, preflight and single Grant; persist original execution identifiers
under the exact Attempt before acknowledgement. Active cancellation requires
that owned execution process and termination evidence before Lease release.
Startup reconciliation must consume that same binding without a new dispatch.
Test the production composition with a controlled fake upstream first.
Real Codex and Electron sandbox validation remain deferred as requested.
