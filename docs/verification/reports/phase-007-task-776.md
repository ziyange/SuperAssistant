# TASK-776 — Project Git metadata discovery

Status: local verification; candidate CI pending. This does not complete
REQ-007 user-editable metadata or enable Project execution.

The initial integration test failed because the Project controller always
returned null repository and branch metadata. Registration now runs bounded
read-only Git queries without a shell, strips inherited Git overrides, and
stores a sanitized repository basename plus a default branch only when the
local origin HEAD symbolic ref proves it. Non-Git and failed discovery remain
registerable with null metadata. Renderer projections sanitize stored values
again and never expose remote URLs or absolute Project paths.

Disposable Git/non-Git and SQLite-reopen tests passed. Mutating the code to
retain a hostile inherited GIT_DIR made the test fail; restoring filtering
passed. Mutating it to guess the current branch as default also failed the
test; restoring the null fallback passed. Existing Project registration and
renderer tests passed 8/8. Targeted lint and typecheck passed. No user
Project, remote URL, real credential, Git network operation or Project write
was used.

Full production build, lint and typecheck passed. Full unit suite passed 489
with six PostgreSQL-dependent skips across 152 files; contract suite passed
49 across eight files. Before this report, ordered governance scanned 314
Markdown files, passed Task Packs, traceability and five Schemas, returned
anchored runtime Exit 0 and passed 34 Python tests. Re-run after this report.

The user-edit path, Agent association, authoritative Git baseline checks,
trusted authorization, execution, real Codex and Electron sandbox remain
open. Default branch is unavailable when origin HEAD is not locally evidenced.
New candidate GitHub CI remains required.
