# TASK-738: Adapter typecheck coverage

> Candidate: uncommitted changes on codex/task-720-audited, base db83fb9. This report is not M1 acceptance.

## Scope and findings

- REQ-090/091/092/093/095/096/099: both adapter tsconfig files selected zero files; prior successful typecheck results did not establish adapter type safety.
- Preserved strict settings; enabled source and test inclusion. The Codex production change treats a missing first line as malformed input. Fixture-only typings were corrected without changing authorization behavior.
- Compiler --listFilesOnly selected 25 Codex adapter source/test files and 21 DSH adapter source/test files.

## Evidence (2026-11-05, Windows)

- Node 22.19.0; npm 10.7.0. Commands run from the candidate worktree.
- Coverage regression before fix: 2 failures, exit 1, both compiler lists empty. After fix: 2 passed, exit 0.
- Root npm run typecheck: exit 0, both adapter workspaces included.
- npm run lint: exit 0 after correcting a test global declaration.
- npm run build: exit 0; this is a build, not a sandbox verification.
- Vitest unit: 148 files passed, 326 tests passed, 6 skipped; exit 0. Skips are not acceptance evidence.
- Vitest contract: 8 files and 35 tests passed; exit 0.
- Runtime trace build anchored to TASK-738: exit 0, no offending files or uncommitted transactions.
- Initial root typecheck/build attempt failed because nested npm selected an incompatible ambient Node/npm; rerun used a temporary npm 10.7.0 wrapper with Node 22.19.0. No lockfile or dependencies were changed.

## Limitations

No Electron sandbox or real Codex execution validation was run, as requested. This task does not establish H1 completion or authorize merge. Earlier reports remain historical and their adapter typecheck coverage is superseded by this correction.
