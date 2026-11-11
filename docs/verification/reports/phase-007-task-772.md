# TASK-772 — Explicit dispatch guard

Status: local verification only; candidate CI pending. Requirements REQ-027,
030, 031, 038, 090, 091, 095 and 098 are not accepted end to end.

Before implementation, the new tests failed four cases because the dispatcher
claimed or sent commands with no guard and ignored rejecting guards. The
dispatcher now requires an explicit guard before claim; after claim, only
literal true permits start or resume. Failure marks the claim uncertain and
does not acknowledge or invoke the adapter. A SQLite integration test proves
denial transitions the real Outbox and Attempt to RECONCILING and UNKNOWN.
Tests explicitly inject permitting fixtures; no such fixture is wired into
the production app.

On Windows, the targeted tests passed 48/48 and targeted lint passed. Build,
full lint and typecheck passed. Full unit tests after the final test edit:
484 passed, six database-dependent cases skipped, 152 files. Contract tests:
49 passed across eight files (before the final test-only change). The six
skipped cases require the separate PostgreSQL job and are not a local pass.

The full ordered governance run before this report scanned 306 Markdown files,
passed Task Pack, traceability and schema checks, returned anchored runtime
Exit 0 and passed 34 Python tests. Re-run after this report. Latest previous
candidate `fa3678a` passed [application CI](https://github.com/ziyange/SuperAssistant/actions/runs/42943508672)
and [documentation CI](https://github.com/ziyange/SuperAssistant/actions/runs/42943508940);
those results do not cover this change.

This boundary does not implement a trusted live guard, atomic snapshot
revalidation, worker ownership proof, lease renewal integration, fencing of
external writes, production startup integration or end-to-end recovery. The
separate legacy ExecutionOrchestrator must not be treated as guarded. Real
Codex and Electron sandbox validation remain deferred. All of these limits
remain open for formal acceptance.
