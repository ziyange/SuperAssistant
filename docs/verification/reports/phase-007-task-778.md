# TASK-778 — Explicit local Codex assignment

Status: locally verified; candidate CI pending. This is configuration, not
live health, Function discovery, authorization, execution, or H1/M1 acceptance.

The Project Center can explicitly associate one active local Project with its
persisted local Codex Agent. Main-process SQLite resolves the Agent in the
same active owner Workspace; the Renderer supplies only the Project ID.
Foreign, locked, inactive, missing or conflicting records fail closed. A
first assignment increments snapshot and row versions, and a repeated request
is idempotent. It does not create a Task, Grant or Attempt, change the Project
files or assert that the Adapter is available. A Project with another default
Agent cannot be silently overwritten.

The Project, IPC and UI regression tests used temporary SQLite databases,
disposable Git repositories and fake executable discovery. Missing integration,
disabled Agent handling and version increment were checked with RED-to-GREEN
tests. In particular removing the row-version increment caused the explicit
assignment test to fail (expected 2, actual 1); restoring it passed.

On Windows, the final local production build, lint and typecheck succeeded.
Full unit suite: 153 files, 505 passed and six PostgreSQL-dependent skips;
contract suite: eight files, 49 passed. The targeted assignment test passed
one test with six unrelated tests filtered out. Governance before this report:
318 Markdown files scanned, Task Packs, requirements traceability, five
schemas and anchored runtime Exit 0 passed; 34 Python tests passed. Governance
must be repeated after this report. These skips are not acceptance evidence.

Candidate CI has not yet run for this change. No real Codex execution,
Electron sandbox validation or real Electron end-to-end acceptance was run.
Those explicitly deferred checks, live capabilities, a complete Proposal
and authorization path, execution/recovery, Team integration and their
required acceptance gates remain open. Do not merge as an accepted H1/M1
or H1–H3 product on this evidence.
