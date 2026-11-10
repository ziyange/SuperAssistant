# TASK-767 — Development application CI

Conclusion: local gate implementation verified; remote CI remains PLANNED
until it runs on a clean candidate SHA. This does not accept H1/M1 or release.
Candidate is an uncommitted patch based on db83fb9.

The application workflow adds a Windows Node 22.19.0 build, lint, typecheck,
unit and contract job and a separate disposable PostgreSQL 16 compatibility
job. The Windows unit job permits exactly the six named database skips; the
database job runs both source files with zero skips. The new summary checker
rejects missing, malformed, failed, zero-test, inconsistent or unapproved
skipped results and requires named files to contain a passing test.

The checker tests initially failed because the checker did not exist, then
passed 5/5. Actual local JSON results passed the checker: 478 passed and 6
approved database skips across 152 unit files; 49 passed and zero skipped
across 8 contract files; and 13 passed with zero skipped across two files on
a fresh PostgreSQL 16.4 instance. The disposable server stopped; its data
and report were retained under the local temporary sa-ci-pg directory.
Both workflow YAML files parsed locally. Production build, lint and typecheck
exited 0. Local execution does not establish GitHub runner compatibility.

The existing documentation workflow originally applied TASK-000's scope to
the complete later history and returned runtime Exit 2. The exact workflow
was added to this task under standing blocker-remediation authorization; it
now checks the complete chain with the TASK-767 scope anchor. The anchored
plan check returned exit 0. This does not retroactively turn the original
Exit 2 into a pass. Future task scope changes must update the CI anchor.

Before this report, ordered governance checked 296 Markdown files and 114
Task Packs, traceability, five schemas, anchored goal runtime exit 0,
34 Python tests and git diff --check. Repeat affected checks after this
report. Real Codex and Electron sandbox verification remain explicitly
deferred, and the workflows do not claim either passed. PostgreSQL 17.x,
real Adapter execution, clean-SHA checks and actual remote CI remain open.
