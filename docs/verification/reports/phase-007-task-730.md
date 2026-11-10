# TASK-730 worktree cleanup safety evidence

Status: focused safety fix verified; M1 and overall G2 are not accepted. Candidate: db83fb926269a66fea1bb3c1332c9b9c5e6526b9 plus uncommitted TASK-721 and TASK-727–730 changes. Windows, Node 22.19.0; 2026-11-04.

- The previous creation-failure handler invoked Git worktree removal with force. A disposable real-Git diagnostic created an untracked sentinel in a new worktree and confirmed the old forced removal erased it. No user repository was used.
- The handler now invokes ordinary Git worktree removal only. Git refuses to remove a dirty or ambiguous worktree, and the original creation failure is preserved.
- An initial restricted-environment test failure was not valid red evidence: the operating-system execution sandbox prevented the test's Git shell hook from starting. After allowing the local temporary hook, the focused real-Git suite passed 3/3: normal isolated creation, preserving an untracked sentinel and Git registration after a branch conflict, and cleaning a truly clean failed worktree.
- Full unit regression with local loopback and a single worker: exit 0; 146 files passed; 311 tests passed, 6 skipped, 317 discovered. Skips remain unverified.
- Full lint exited 0; desktop typecheck and main-process TypeScript build exited 0. The anchored runtime verification and documentation link check passed before this report.
- This validates the cleanup path only; it does not establish complete worktree isolation, real Electron sandbox behavior, Codex execution, G2, or M1. No merge, push or removal of a user worktree occurred.
