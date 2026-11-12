# TASK-779 — Grant uniqueness

Status: local verification; candidate CI pending. This repair does not connect
Proposal IPC or authorize a real execution and does not complete H1/M1.

REQ-021, REQ-024, REQ-025 and REQ-027: an in-memory reproduction first created
two issued grants for one actor and Proposal using different confirmation
keys. The regression test then failed on the second Grant identity before the
fix. A further test failed when an alternate confirmation key could be reused
for a different Proposal; both tests pass after the fix.

Migration 022 adds a partial unique index for ISSUED grants and a table binding
all accepted confirmation keys, backfilled from existing records. Grant issue
uses an immediate SQLite transaction and resolves different keys to the same
issued Grant. A distinct key can issue a new Grant only after the former grant
is terminal; an expired but still ISSUED grant blocks replacement. The existing
authoritative actor, digest, action and expiry checks remain.

Two worker threads writing through independent SQLite connections produced one
insertion and one unique-constraint rejection. A fixture representing duplicate
legacy records made migration fail, retained both rows and schema version 21 in
the original and the backup, and required no automatic history changes. The
fixture disables foreign keys only to isolate the index in disposable data.
Existing confirmation-key backfill, terminal retry, conflicting key reuse and
same-key idempotency are covered. An initial fixture run failed due to foreign
keys and left a locked disposable temporary file; the corrected fixtures close
their databases and pass.

On Windows the final production build, lint and typecheck succeeded. Full unit
suite: 153 files, 508 passed, six PostgreSQL-dependent tests skipped; contract
suite: eight files, 49 passed. Pre-report governance scanned 320 Markdown
files, passed Task Pack checks, requirement traceability and five schemas,
returned runtime Exit 0 and passed 34 Python tests. Repeat governance after
this report; skipped tests are not treated as passed.

Candidate CI has not yet run for this change. Real Codex execution and Electron
sandbox verification remain deferred by user decision. Migration failure with
existing duplicate issued grants requires an explicit manual data audit rather
than deleting, silently merging or automatically revoking authorizations.
