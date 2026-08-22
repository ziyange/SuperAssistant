# PHASE-004 TASK-408 hierarchical resource-conflict report

Status: completed locally.

Root cause: `scheduleResources` checked only exact owned keys. It therefore
allowed both `project:one` and `project:one:file:src/index.ts`, which permits
an overlapping parent/descendant write scope. The repair treats equality and
either colon-delimited ancestor/descendant relationship as a conflict. Raw
prefixes such as `project:one` and `project:one-other` remain independent.

Red evidence: the focused suite failed two assertions before the repair, one
for each direction of the parent/child relationship. Green evidence: focused
suite passed 32/32. Full local evidence: lint and typecheck passed; production
build passed; 74 unit files / 171 tests passed; 4 contract files / 29 tests
passed; 6 Playwright tests passed. Governance and build-mode runtime-trace
results are appended after their final execution. Remote CI remains planned.
