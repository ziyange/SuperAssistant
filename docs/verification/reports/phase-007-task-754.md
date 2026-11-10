# TASK-754 — Outbox claim race

Conclusion: local task-scope checks passed; this is not M1 acceptance.
Candidate is an uncommitted patch based on `db83fb9`, not a clean SHA.
REQ-027, REQ-030, REQ-032, REQ-038, REQ-049, REQ-090–091, REQ-096 and
REQ-098 have only the narrow evidence below.

A deterministic test interleaved two repositories: the second claimant won
after the first read but before its conditional update. Before the fix both
received the same message; after the fix the loser receives null. Existing
claim, acknowledgement and inbox deduplication assertions remain intact.

Windows, 2026-11-10; Node 22.19.0; npm 10.7.0. Focused Outbox tests:
3 passed. Root build, lint and typecheck: exit 0. Contract suite: 8 files,
49 passed. Full unit suite: 150 files, 418 passed, 6 skipped. The skips do
not count as acceptance. Ordered governance and anchored goal trace must be
rerun after this report.

This fix does not identify or fence the claimant, protect acknowledgement
from a stale claimant, recover an interrupted DISPATCHING message, verify
adapter outcomes, or reconcile unknown effects. The current dispatcher and
SQLite Outbox ports still need integration and contract work; do not wire
real dispatch. Capability and Git-baseline checks, real Codex, Electron
sandbox, clean-SHA evidence, remote CI and H1–H3 acceptance remain open.
