# TASK-734 preload build artifact evidence

Status: build-format correction verified statically; real Electron sandbox, G2 and M1 acceptance remain open. Candidate: db83fb926269a66fea1bb3c1332c9b9c5e6526b9 plus uncommitted TASK-721 and TASK-727–734 changes. Windows, Node 22.19.0, npm 10.7.0; 2026-11-05.

- The new artifact test first failed because normal TypeScript emission produced index.js and no index.cjs. The previous real-Electron diagnostic in TASK-721 recorded an ESM preload startup failure; no real Electron sandbox test was run during this task.
- The desktop build now typechecks preload sources and uses existing pinned Vite to produce one CommonJS preload bundle with Electron externalized. Main references index.cjs; sandbox, contextIsolation, Node integration and preload IPC permissions are unchanged.
- The artifact test passed after a clean production build: Node syntax check succeeded, exactly one static require targets Electron, no relative require or top-level ESM syntax remains. Existing window-policy unit tests passed. These checks are not proof that Electron starts the preload or enforces its IPC boundaries.
- Exact root npm run build, npm run lint and npm run typecheck exited 0 under Node 22.19.0 and npm 10.7.0. Full unit suite: 146 files, 318 passed, 6 skipped, 324 total; exit 0. Contract suite: 8 files, 35 passed, none skipped; exit 0.
- Runtime trace returned 0 before this report. Real Electron sandbox/preload verification, native chooser E2E, skipped database cases, G2, H1 performance, CI and M1 remain open. No merge, push or removal of a user worktree occurred.
