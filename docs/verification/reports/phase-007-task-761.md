# TASK-761 — Internal SQLite outbox message bridge

Conclusion: bounded local integration verified; no production dispatch is
enabled and this is not H1/M1 acceptance. Candidate is an uncommitted patch
based on db83fb9, not a clean commit. REQ-027/030/038/049/092/093/099 are
addressed only for this internal message boundary.

The SQLite claim now returns a strictly decoded start or resume payload
compatible with the existing dispatcher. Invalid JSON, unknown message types,
additional or missing fields, and mismatched Attempt identifiers are
quarantined for reconciliation. A fake adapter failure leaves its outbox
row RECONCILING and nonterminal Attempt UNKNOWN. Claim token fencing
continues to protect acknowledgement and uncertainty.

The first targeted test demonstrated that the old repository passed
undefined to start and treated a resume as start. Five negative cases also
failed because malformed messages were dispatched. After implementation,
the targeted SQLite and dispatcher test files passed 18 tests; the added
failure integration case was subsequently included in the full suite.

On Windows, 2026-11-10, Node 22.19.0: build, lint, typecheck exited 0; the
full unit suite outside the restricted process sandbox passed 437 tests,
with 6 PostgreSQL tests skipped, across 150 files. The contract suite passed
49 tests across 8 files. The six skips are not acceptance evidence.
Before writing this report, governance passed across 284 Markdown files,
108 Task Packs, requirement tracking, five schemas, anchored goal runtime
exit 0, 29 Python tests and git diff --check. Repeat affected governance and
runtime checks after the report.

The queue payload is not a complete SAI command. Critically, the claim path
does not independently fence a pending message against an Attempt that has
since entered UNKNOWN/RECONCILING, nor does it revalidate Grant, snapshot,
lease and external Adapter state immediately before dispatch. These are
blocking gaps; no production wiring or real Adapter execution is authorized
by this task. Real Codex protocol, recovery, clean-SHA and remote CI evidence
are also still missing. Electron sandbox validation remains deferred.
