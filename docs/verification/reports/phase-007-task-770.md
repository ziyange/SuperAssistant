# TASK-770 — CI test failure visibility

Status: IN PROGRESS; remote verification pending.

On candidate `d9c8e5945d56aba01d1ad30b27ee8dfbb569fba9`, [documentation CI](https://github.com/ziyange/SuperAssistant/actions/runs/42939226812) passed and [application CI](https://github.com/ziyange/SuperAssistant/actions/runs/42939226949) passed PostgreSQL 16, Windows install, build, lint and typecheck, but failed Windows unit tests. The JSON-only reporter hid the failing test names in the CI log.

The Windows unit command now uses both console and JSON reporters. A local real Vitest run produced four passing tests, visible console output and a JSON file accepted by the unchanged summary checker. The new candidate must still demonstrate CI output and successful gates; no test result is presumed.

An independent clean checkout at `d9c8e59` installed with npm 10.7 and built, linted and typechecked. Its sandboxed unit run had 471 passing, six expected PostgreSQL skips and seven failures involving process termination, loopback, symlink and worktree operations. An outside-sandbox rerun of all five affected test files passed 37/37, including the seven failures; this does not identify the separate remote CI failure. Real Codex and Electron sandbox verification remain deferred.
