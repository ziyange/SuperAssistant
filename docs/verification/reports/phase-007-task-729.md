# TASK-729 onboarding persistence evidence

Status: implementation and focused verification complete; full H1 and Electron acceptance remain open. Candidate: db83fb926269a66fea1bb3c1332c9b9c5e6526b9 plus uncommitted TASK-721, TASK-727–729 changes. Windows, Node 22.19.0, 2026-11-04.

- Before implementation, the new repository/restart test failed because the repository was absent. Desktop main previously kept the completion flag in memory only.
- Migration 018 adds a singleton SQLite state with a constrained boolean; a new repository implements the existing async port and main initializes it from the platform database. The existing IPC contract and sandbox configuration are unchanged.
- Focused unit command covering onboarding, migration runner and IPC validation: 3 files, 11 tests passed, zero skipped. The onboarding test closes and reopens an actual temporary SQLite database twice, validates default, true, false and the database constraint. Existing migration rollback is tested using a new failing version 19.
- Persistence and desktop TypeScript checks exited 0; persistence production build and desktop main TypeScript build exited 0. A compiled-package in-memory smoke confirmed the new repository and migration are present.
- Full ESLint initially exposed two type-only-parameter false positives in the new test; narrowly documented line suppressions retain the TypeScript rule. The complete lint command then exited 0.
- Full unit regression with local loopback and one worker: 146 files passed; 309 tests passed, 6 skipped, 315 discovered, exit 0. Skips are not acceptance evidence.
- The initial migration-test patch failed before modifying its target because its hunks were out of order; after verifying the target was unchanged, the same pending operation was retried successfully. The audit chain preserves its original intent and successful result.
- Runtime trace at iteration 2 exited 0 before this report. Real Electron sandbox/preload, full product workflow, database-backed Team test gaps, H1 performance and remote CI remain outstanding. No merge or push occurred.
