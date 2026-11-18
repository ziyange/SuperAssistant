# TASK-783 — Local Proposal candidate drafts

Status: local verification; candidate CI pending. REQ-022 and H1/M1 remain open.
The store is not connected to IPC, UI, Grant issuance or execution.

Migration 023 adds an append-only candidate-draft table. Creation structurally
parses the candidate and rechecks the local catalog in the same SQLite
transaction before storing a generated ID, local Workspace and Project,
JSON and an exact-byte SHA-256 checksum. Retrieval requires the unique active
local Workspace and verifies checksum, schema and stored ownership. This is
not an RFC 8785 approval digest or an authorized ProposalVersion.

The storage test first failed against a passthrough stub. It now verifies
invalid and stale candidates are rejected, detached content survives database
serialization/reopening, updates and deletes are blocked, another or locked
Workspace cannot read the draft, and tampered payloads fail closed. No Task or
Grant is created. Migration regressions ran against disposable databases.

On Windows, build, lint and typecheck passed; the full unit suite passed 538
tests across 156 files with six PostgreSQL-dependent skips. The contract suite
passed 49 tests across eight files. Before this report governance scanned 328
Markdown files, validated Task Packs, traceability and five schemas, returned
runtime Exit 0 and passed 34 Python tests. Rerun governance after this report.

The store cannot detect secrets in arbitrary caller text and must not be
exposed until a safe input policy exists. Live health, Git baseline, resource
containment, capabilities, clock, policy, budgets, approved immutable versions,
user review and authorization remain required before execution. No user
Project, real Codex execution or Electron sandbox was accessed. This commit
requires its own remote CI evidence.
