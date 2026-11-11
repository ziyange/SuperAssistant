# TASK-777 — Persisted local Codex registration

Status: local verification; candidate CI pending. This does not complete
Function discovery, Agent-to-Project assignment, live health, execution,
H1/M1, H3/M2 or release acceptance.

The previous native-picker discovery returned an ephemeral observation and
never persisted an Agent. A completed validated read-only discovery now
atomically stores one local runtime registration and a stable Agent. The
path stays in main-process SQLite, not in Renderer projections. Rechecking
updates the same Agent and version; no Function is fabricated. Durable Agent
state remains UNAVAILABLE/PAUSED. After restart the Agent Center shows the
saved version and recheck-required notice; it does not start the saved binary
or treat cached data as live authorization.

Tests first reproduced missing persistence, false success on a failed save,
missing IPC/renderer integration, malformed timestamps and incompatible or
non-string discovery states. They also reproduced duplicate creation in the
presence of an unlinked legacy Codex Agent and implicit replacement of a
locked Workspace. Those cases now fail closed. The legacy identity remains
unreconciled rather than being silently adopted. Migration 021 is additive;
existing backup-before-migration tests pass. IPC strips extra projected fields
and rejects Renderer-provided path parameters.

One initial migration-fixture edit had an unmatched patch context, leaving a
PENDING audit record. The same authorized operation was explicitly retried,
committed in the audit chain and followed by a fresh runtime Exit 0; no
external effect was repeated.

On Windows, targeted regression passed 47 tests before the final additional
state checks; the final four-file security/UI subset passed 36. A clean final
run of production build, lint and typecheck passed; full unit suite passed 500
with six PostgreSQL-dependent skips across 153 files, and contract suite
passed 49 across eight files. A pre-report governance run scanned 316 Markdown
files, passed Task Packs, traceability and five schemas, returned anchored
runtime Exit 0 and passed 34 Python tests. Re-run governance after this report.
No real Codex was launched and no user Project was modified.

Previous candidate `c28a006` passed GitHub application and documentation CI;
new candidate CI is required. Real Codex and Electron sandbox verification
remain deferred by user decision. Trusted live health, executable identity
revalidation, complete Function discovery, Project assignment, Proposal,
authorization and the execution/recovery loop remain open blockers.
