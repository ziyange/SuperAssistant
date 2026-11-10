# TASK-748: Correlated read-only App Server observations

Candidate: codex/task-720-audited at db83fb9 plus uncommitted remediation. Windows; Node 22.19.0 and npm 10.7.0; 2026-11-09 (Asia/Shanghai).

## Scope and evidence

REQ-014/015/018/028/029/049/090/091/098. The internal observation client correlates bounded JSON-RPC replies and projects only sanitized discovery and thread-level status. Existing discovery reuses the same transport. The implementation consults the [official App Server documentation](https://learn.chatgpt.com/docs/app-server), including initialize, account/read and thread/read.

- Initial red run: six tests failed because the client did not exist. Three further red tests reproduced response/exit races and invalid-version reuse; a runtime-method test exposed an attempted synthetic execution request. All were fixed.
- Final focused observation, discovery and supervisor tests: 3 files, 25 passed, exit 0. After a test-comment-only lint fix, the observation suite alone passed 13 tests.
- Root build, workspace typecheck and lint: exit 0. After build, full unit suite: 150 files, 367 passed and 6 skipped; exit 0. Contract suite: 8 files, 48 passed, exit 0. Skips are not acceptance evidence.
- Documentation links, Task Pack structure, REQ tracing, five schemas, anchored runtime trace and git diff --check passed before this report. Initial lint failed on two type-only parameter names and passed after the scoped comment correction.

## Limits

Only initialize, initialized, account/read with refresh disabled and thread/read are used. IDLE does not prove an Attempt succeeded and cannot authorize redispatch. The client intentionally ignores notifications and is unsuitable for an active execution stream. In-process TypeScript privacy is not a sandbox against malicious main-process code; the client is not exposed to renderer IPC. No live App Server, exact-version compatibility, real Codex execution, Electron sandbox validation, H1 acceptance or merge readiness is claimed.
