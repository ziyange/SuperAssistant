# TASK-739: Read-only App Server discovery supervisor

Candidate: codex/task-720-audited at db83fb9 plus uncommitted remediation changes. This is not H1 acceptance.

## Scope

REQ-014/015/017–019/028/029/090/091/094: a single child is supervised for the existing read-only handshake. Failure, timeout, child exit and shutdown cannot return a stale discovery snapshot. Execution and compatibility policy remain unchanged.

## Evidence

Windows; Node 22.19.0, npm 10.7.0; 2026-11-05. Commands from the candidate worktree.

- Initial focused supervisor tests: five expected failures because the supervisor did not exist.
- Focused tests after implementation: seven passed, exit 0, including real disposable fake-child teardown and a mocked hung Windows tree terminator.
- The hung-terminator test was observed failing with an unhandled rejection and a hung shutdown before the fix; it passed afterward. A timeout reports failure and does not assert that a still-running process was terminated.
- npm run lint, npm run typecheck and npm run build: exit 0.
- Vitest contract: 8 files and 35 tests passed, exit 0.
- Initial concurrent build/unit run: one failure in runtime-package.test.ts because the desktop build cleaned dist while the test read it. After build finished, the ordered unit rerun passed 149 files, 333 tests; 6 skipped, exit 0. Skips are not passing evidence.
- TASK-739 structural check and anchored runtime trace: exit 0. Documentation link, requirement mapping, five schema checks and git diff --check: exit 0.

## Limitations

The supervisor is not connected to Electron IPC or a real Codex process. Existing 0.121.x compatibility gating is unchanged; local 0.157.1 remains unsupported. No actual execution, model call or real Electron sandbox verification was performed. M1 and merge gates remain unmet.
