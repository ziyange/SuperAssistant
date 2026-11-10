# TASK-736 truthful onboarding navigation evidence

Status: component behavior verified; real Codex, task execution, Electron E2E and M1 remain incomplete. Candidate: db83fb926269a66fea1bb3c1332c9b9c5e6526b9 plus uncommitted TASK-721 and TASK-727–736 changes. Windows, Node 22.19.0, npm 10.7.0; 2026-11-05.

- The original component test failed because Start Task was enabled and only marked onboarding complete instead of starting a Task.
- Add Project now navigates to Project Center, Connect Codex navigates to an explicitly UNAVAILABLE Agent Center, and Start Task is disabled with a visible reason. No action records false completion. This temporary state does not satisfy H1 acceptance.
- Focused renderer tests passed 5/5. The existing Playwright expectation that a click falsely completes onboarding was updated, but the E2E test was not run because real Electron sandbox/preload verification is deferred.
- Root production build, full lint and workspace typecheck exited 0. Full unit regression: 147 files, 324 passed, 6 skipped, 330 total; exit 0. Fake-service contracts: 8 files, 35 passed, none skipped; exit 0.
- Codex discovery is still isolated and version-gated, real execution is unavailable, and M1 remains unaccepted. No merge, push or user-worktree removal occurred.
