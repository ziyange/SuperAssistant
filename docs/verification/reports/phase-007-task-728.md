# TASK-728 lint remediation evidence

Candidate: `db83fb926269a66fea1bb3c1332c9b9c5e6526b9` plus uncommitted TASK-721, TASK-727 and TASK-728 changes. Windows, Node 22.19.0. Date: 2026-11-04.

- Before the change the full ESLint command reported 12 core `no-unused-vars` errors in five TypeScript files. An independent stdin case containing only `export interface Transport { request(path: string): Promise<void>; }` reproduced the false positive on `path`.
- The configuration disables the JavaScript core rule only for those five exact TypeScript paths; the already-enabled `@typescript-eslint/no-unused-vars` rule remains active. No application logic changed.
- Full equivalent lint command, `node node_modules/eslint/bin/eslint.js --max-warnings 0 --no-error-on-unmatched-pattern apps packages services --ext .ts,.tsx,.mjs`, exited 0 without warnings. This is the same ESLint command as the root lint script, invoked directly with Node 22.
- Programmatic ESLint stdin checks for all five exact file paths verified valid interface parameters produce zero errors, and an actual unused local is rejected by `@typescript-eslint/no-unused-vars` in each case. All five checks passed.
- The task pack check and initial anchored runtime trace returned exit 0. Final governance and candidate-wide acceptance must still be run after this report write; this lint result does not establish G2, M1, or merge readiness.
