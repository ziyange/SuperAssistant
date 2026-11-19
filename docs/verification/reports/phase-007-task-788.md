# TASK-788 verification — bounded fake App Server lifecycle

Baseline: `0941540ec2c1894619024026272eefd3bb9d34e0`. Scope and REQ IDs:
[TASK-788](../../delivery/tasks/TASK-788.md). Windows, 2026-11-19 CST;
Node 22.19.0, npm 10.7.0, Vitest 3.2.4; Node stdio fixture advertising
`fixture-app-server/0.121.0`. Application commands ran in the audited
candidate worktree, not the main checkout. This is deterministic offline
integration evidence, not H1/M1 acceptance.

- Function trust is explicitly injected by the fixture, constrained to the
  known runtime/Function/capability, one output resource and one action. An
  unverified runtime or capability cannot produce a full review. No production
  entry point is installed.
- The review hashes the complete immutable candidate. Different budget,
  malformed Unicode, replaced review records and stale catalog or Git inputs
  cannot authorize new effects. Exact confirmation replay returns the original
  Attempt and uses one consumed Grant. A baseline change before worktree setup
  or an Agent pause after thread creation prevents `turn/start`.
- Concurrent start requests produce one effect in the approved worktree and
  leave the source checkout unchanged. The test closes the original child and
  reopens the same on-disk SQLite database. Reconciliation requests only the
  persisted, dynamically generated Thread ID and accepts only its exact
  terminal Turn. Wrong Thread or Turn, duplicate Turn, active Turn and RPC
  error cannot settle the Attempt. A lost start receipt remains `UNKNOWN`
  without status guesses or replay. Neither case completes the Task or
  releases the Lease.

Red evidence: the initial targeted run returned 1 for the missing loop; a
later negative case returned 1 because an unpaired surrogate was accepted.
The Agent-pause case returned 1 before enforcing CONNECTED/AVAILABLE after the
thread response. The first full run also caught a rollback-test fixture
reusing now-valid migration number 024; using the next migration number
restored the intended rollback test. All changes were reviewed read-only
against TASK-788, and the availability, durable restart and exact-response
findings were revisited after correction.

Local application verification: production builds for domain, persistence,
Codex Adapter, desktop main/preload/renderer and Team Service, root lint and
workspace typecheck exited 0. Full Vitest unit: 547 passed, 0 failed with six
database-dependent cases reserved for the separate PostgreSQL job. Contract:
49 passed, 0 skipped. Four lifecycle cases are in the unit suite. No secret,
user Project, production database, real Codex or Electron sandbox was used.

Ordered governance verifies nonempty docs, all Task Packs, requirements
traceability, five schemas, anchored Plan trace, Python unit tests and exact
tracked/staged/untracked file scope. The clean candidate's documentation and
application CI, including PostgreSQL 16 compatibility, must be observed
separately on its published SHA; local evidence cannot replace it.

Desktop confirmation, cancellation and terminal lease reconciliation are not
enabled by this composition. Real Codex and Electron sandbox verification
remain deferred; do not accept H1/M1, H3/M2 or release on this evidence.
