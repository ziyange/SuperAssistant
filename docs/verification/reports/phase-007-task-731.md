# TASK-731 Project catalog persistence evidence

Status: scoped persistence behavior verified; Project registration UI, canonical path validation and M1 remain incomplete. Candidate: db83fb926269a66fea1bb3c1332c9b9c5e6526b9 plus uncommitted TASK-721 and TASK-727–731 changes. Windows, Node 22.19.0; 2026-11-04.

- Before implementation, the real SQLite regression failed because an equivalent normalized path raised a duplicate error rather than returning the original Project.
- The repository now returns the existing Project only for the explicit Workspace/canonical-key uniqueness conflict, with its original ID and metadata; other database errors propagate. Listing uses one Workspace-scoped query with deterministic name and ID order. Filesystem realpath and access checks remain the responsibility of the future main-process service.
- Focused SQLite tests passed 2/2, including duplicate normalization, unchanged metadata, cross-Workspace separation and list ordering. Domain and persistence TypeScript checks passed; full lint passed.
- Full unit regression, with local loopback and two workers: exit 0; 146 test files passed, 312 tests passed and 6 skipped, 318 discovered. The skipped cases remain unverified.
- Anchored runtime verification and pack validation passed before this report. This evidence does not establish actual folder selection, registration IPC, realpath/alias handling, Electron sandbox, H1 or merge readiness.
