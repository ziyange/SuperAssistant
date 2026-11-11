# TASK-773 — Disable the legacy direct-dispatch bypass

Status: local verification; candidate CI pending. This is not execution,
H1/M1, H3/M2 or release acceptance.

The legacy `ExecutionOrchestrator` had no production callers but directly
created state and invoked an Adapter without the guarded Outbox. Four RED
tests covered CREATED, RUNNING, UNKNOWN and RECONCILING; the first two exposed
actual side effects and the latter two showed the old branch had a different
error. The legacy entry point now rejects every state without either side
effect. The real execution path remains disabled, not implemented by this fix.

On Windows, targeted dispatcher and SQLite regression tests passed 51/51;
targeted lint and typecheck passed. Production build, full lint and typecheck
passed. Full unit suite: 487 passed and six PostgreSQL-dependent cases skipped
across 152 files; contracts: 49 passed across eight files. The database cases
require separate PostgreSQL evidence and are not a local pass.

The prior `32a99e5` candidate passed [application CI](https://github.com/ziyange/SuperAssistant/actions/runs/42946644792)
and [documentation CI](https://github.com/ziyange/SuperAssistant/actions/runs/42946644696).
Those results do not cover TASK-773; run CI on the new candidate. Live Grant
and snapshot checks, real worker ownership, renewal integration, external
write fencing, production wiring and recovery remain open. Real Codex and
Electron sandbox validation remain deferred by user decision.
