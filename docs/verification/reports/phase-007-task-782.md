# TASK-782 — Local Proposal catalog comparison

Status: local verification; candidate CI pending. This does not complete
REQ-022 or H1/M1, or enable confirmation and execution.

The new main-process function parses the candidate and reads a consistent
SQLite transaction. It checks the unique active local-owner Workspace, active
Project and its assigned registered non-disabled Codex Agent, active Function,
and stored Project, Agent and Function versions. Matching returns only
REQUIRES_LIVE_VERIFICATION. Invalid, foreign, locked, stale, ambiguous or
missing records return REJECTED without leaking stored paths or secrets.

An in-memory SQLite fixture first failed with an intentional fail-closed
stub; the actual comparison passed. The test covers matching records, foreign
Workspace, ambiguous or locked Workspace, disabled Agent and Function,
missing registration, assignment, identity and version mismatch, and confirms
no Grant or Task was created. Additional identity and registration-version
assertions were added after the full suite started and separately passed.

Windows production build, lint and typecheck passed. The full unit suite
passed 537 tests across 155 files with six PostgreSQL-dependent skips; the
contract suite passed 49 tests across eight files. Before this report,
governance scanned 326 Markdown files, checked Task Packs, traceability and
five schemas, returned anchored runtime Exit 0 and passed 34 Python tests.
Rerun governance after this report; skips are not passes.

Live Agent health, baseline, capabilities, resource containment, trusted
clock, policy, budgets, immutable Proposal persistence, user review and
authorization remain unverified. This read is not atomic with a later Grant
or Attempt and must never authorize dispatch. No real Codex, sandbox or user
Project was accessed. Remote CI must run for the candidate commit.
