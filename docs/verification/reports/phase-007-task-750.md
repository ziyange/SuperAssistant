# TASK-750 — Desktop Codex discovery integration

Conclusion: REQUEST_CHANGES for integrated acceptance. This is an uncommitted
working patch based on `db83fb9`, not a clean candidate SHA or M1 acceptance.
REQ-014, REQ-015, REQ-017–019, REQ-028–029, REQ-090–091, REQ-094 and
REQ-098 have only the limited evidence stated below.

## Implemented boundary

The Agent Center exposes an explicit Check Codex action. The renderer supplies
no executable path or arguments. The main process asks the user to select a
Windows executable, resolves its canonical path, performs a bounded version
check and invokes the shared read-only App Server supervisor. The projection
contains only a last-check status, version and timestamp; no upstream IDs,
path, account details, or execution controls are projected. The user-selected
executable is a trust decision and is run under the current user's authority.
The old version allowlist remains unchanged.

The shared child environment now forwards only SystemRoot, TEMP, TMP,
USERPROFILE, HOME, APPDATA and LOCALAPPDATA, when present. This is needed
for profile configuration; arbitrary environment values are not copied.

## Evidence

On Windows, 2026-11-10, Node 22.19.0 and npm 10.7.0, working directory
`E:/Programs/Super Assistant/.worktrees/TASK-720-audited`:

- Red tests reproduced missing selection/IPC/UI behavior and unchecked invalid
  health status; their focused green tests passed after implementation.
- Fake App Server integration uses a real supervised local child, not a real
  Codex process. A Windows fake version-probe process tree was terminated on
  timeout and both parent closure and descendant exit were checked.
- Process existence checks reject EPERM and unknown failures as proof of exit;
  only ESRCH is accepted. Red-to-green contract tests verify this boundary.
- Production build: exit 0. Root lint and typecheck after the final code
  changes: exit 0. Offline `npm ci --dry-run --ignore-scripts --offline
  --no-audit --no-fund`: exit 0; the lock change was an explicit workspace
  dependency edit, not an actual dependency installation.
- After the version-probe changes, contract suite: 8 files, 49 passed. Full
  unit suite with one worker: 150 files, 385 passed, 6 skipped. This remains
  an uncommitted patch, not a clean-SHA acceptance run.
- Earlier full unit run with two workers: 1 failure, 378 passed, 6 skipped:
  the worktree isolation test timed out at 15 seconds under concurrent load.
  Its subsequent isolated run passed all 3 tests. No timeout was increased.
- Governance before this report: 262 Markdown files, no link issues;
  all task structures valid; traceability and schemas passed; anchored goal
  trace exit 0; 29 governance tests passed; `git diff --check` exit 0.
  The report itself requires a subsequent runtime and document check.

## Outstanding acceptance and risk

No real Codex executable, live account, real Electron process, preload
sandbox or GUI end-to-end flow was tested. These remain planned, not passed.
The version probe is time-bounded and process-tree termination has been tested
with a Windows fake tree, not a real Codex process or deliberately malicious
executable. Selection of an untrusted executable can execute arbitrary code.
Shutdown failure is reported as unavailable but persistent recovery from
unconfirmed termination remains unproven before M1. Actual installed Codex
version compatibility remains unknown.
The selected path cannot be passed from the renderer. The task does not
implement or enable execution, restart reconciliation, real authorization,
Decision, or complete H1–H3 acceptance.
