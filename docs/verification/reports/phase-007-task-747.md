# TASK-747: In-process synthetic cancellation deduplication

Candidate: codex/task-720-audited at db83fb9 plus uncommitted remediation. Windows; Node 22.19.0 and npm 10.7.0; 2026-11-09 (Asia/Shanghai).

## Evidence

REQ-027/029/030/031/033/090/093/098. Within one synthetic adapter instance, cancellation calls for the same Attempt/process share one outcome; changed process identity is rejected. Incomplete outcomes are retained and are not automatically retried. Invalid process identity is rejected before interrupt.

- Red run: four failed tests reproduced concurrent duplicate effects, changed process reuse, retry of uncertain release and interrupt with invalid process identity.
- Focused cancellation contract: 15 passed, exit 0. Full contract: 8 files, 48 passed, exit 0.
- Root build, lint and workspace typecheck: exit 0. Full unit suite after build: 149 files, 354 passed and 6 skipped, exit 0. Skips are not acceptance evidence.
- Documentation links, Task Pack structure, REQ traceability, five schemas, anchored runtime trace and git diff --check passed before this report.

## Limits

Deduplication is in memory and does not survive process restart. The synthetic protocol is not real Codex; process ownership, durable cancellation/reconciliation, actual sandbox verification and H1 end-to-end acceptance remain unproven. No merge or release readiness is claimed.
