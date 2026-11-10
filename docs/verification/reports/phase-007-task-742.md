# TASK-742: Trusted authorization clock

Candidate: codex/task-720-audited at db83fb9 plus uncommitted remediation. Windows, Node 22.19.0, npm 10.7.0; 2026-11-05.

## Evidence

REQ-024/025/027/028/030/090/094/096: local Grant creation and Attempt creation now use a control-plane clock; legacy caller timestamps do not determine authorization or stored creation times. Expiry instants are parsed, and invalid clock or expiry fails closed. Existing idempotent replay does not create another side effect.

- Red tests: 2 failures reproduced backdated Grant issuance and expired Grant consumption. Focused green: 3 files, 18 tests passed, exit 0; includes invalid clock and exact expiry boundary.
- Root build, lint and workspace typecheck: exit 0. Full unit regression after build: 149 files, 347 passed, 6 skipped, exit 0. Contract: 8 files, 35 passed, exit 0. Skips are not passing evidence.
- Documentation links, task structure, REQ tracing, schema checks, anchored runtime trace and git diff --check passed before this report.

## Limits

Injected clocks are for trusted control-plane/test composition, never renderer input. Actor identity and the initial resource/worktree policy still need trusted binding before dispatch. No real Codex, Electron sandbox or H1 end-to-end acceptance is claimed.
