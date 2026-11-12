# TASK-781 — Proposal candidate time and budget

Status: locally verified; candidate CI pending. REQ-022 and H1/M1 remain open.

The non-authoritative H1 candidate requires canonical UTC millisecond
creation, expiration and deadline values with expiry and deadline later than
creation. A strict budget requires a positive safe-integer duration and
explicit nullable token and cost caps; cost uses integer minor units and a
three-uppercase-letter currency code. Null means no limit was supplied, not
permission to spend without a limit.

The expanded suite first failed because the previous schema rejected the new
fields; after implementation, 28 targeted tests passed, covering malformed
dates, time order, invalid numbers, missing limits, currency syntax, unknown
fields and detached nested input. Parsing neither checks a trusted current
clock nor confirms a real currency or enforces budgets. It does not persist an
immutable version, authorize a Grant, expose review UI or dispatch execution.

On Windows, the production build, lint and typecheck passed. Full unit suite:
154 files, 536 passed and six PostgreSQL-dependent cases skipped. Contract
suite: eight files, 49 passed. Before this report governance scanned 324
Markdown files, checked Task Packs and traceability, validated five schemas,
returned runtime Exit 0 and passed 34 Python tests. Rerun governance after
this report; skips are not passes.

One documentation patch initially failed to match, leaving an audit intent
pending without changing its target. The same operation was reconciled under
the audit lock, its result recorded and runtime Exit 0 confirmed before
continuation. No user Project, real Codex execution or Electron sandbox was
accessed. The prior candidate 98993c9 passed documentation and application
CI, including PostgreSQL 16; this candidate needs its own CI.
