# TASK-738: Make adapter TypeScript checks nonempty and effective

## Status
APPROVED
PHASE: PHASE-007
MAX_ITERATIONS: 4
user_confirmed: true
Authorization: user-approved continuous governance and H1 remediation.

## Requirement IDs
REQ-090, REQ-091, REQ-092, REQ-093, REQ-095, REQ-096, REQ-099

## Objective
Correct the Codex and DSH TypeScript configurations that currently check zero files and resolve the real errors that become visible without weakening strict compiler settings.

## Context Pack
- docs/verification/quality-gate.md
- docs/verification/reports/phase-007-task-735.md
- docs/delivery/phase-007-integration-recovery.md

## Must Read
- AGENTS.md
- docs/README.md
- docs/requirements.md
- docs/verification/quality-gate.md
- packages/codex-adapter/tsconfig.json
- packages/dsh-adapter/tsconfig.json
- tsconfig.base.json

## Allowed Files
- docs/delivery/tasks/TASK-738.md
- docs/verification/reports/phase-007-task-738.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- docs/verification/quality-gate.md
- packages/codex-adapter/tsconfig.json
- packages/dsh-adapter/tsconfig.json
- packages/codex-adapter/src/stdio-transport.ts
- packages/codex-adapter/tests/app-server-discovery.test.ts
- packages/codex-adapter/tests/discovery.contract.test.ts
- packages/codex-adapter/tests/typecheck-coverage.test.ts
- packages/dsh-adapter/tests/dsh-tool-guard-plugin.test.ts
- packages/dsh-adapter/tests/dsh-tool-runtime-conformance.test.ts

## Forbidden Files
Do not weaken strict compiler settings, skip tests, change production DSH permissions or Codex compatibility, alter package locks, archived reports, user projects or Electron sandbox settings.

## Interfaces / Contracts
Both adapter projects must include their source and TypeScript tests. A regression test invokes the real TypeScript compiler file listing and fails if expected source or test files are absent. Existing external adapter interfaces remain unchanged.

## Data Constraints
No real credentials, databases, network or external project mutation.

## UI Constraints
No graphical UI changes.

## Implementation Requirements
Document that previous adapter typecheck evidence was empty, then add and run failing compiler-coverage tests. Enable source/test inclusion, resolve uncovered strict errors through narrow type-safe changes, and preserve runtime behavior and security assertions.

## Test Requirements
Run the coverage regression red and green, root typecheck with nonempty compiler listings, lint, affected unit and contract tests, full unit regression and anchored runtime verification. Do not run real Electron sandbox validation.

## Acceptance Criteria
Compiler listings contain adapter source and tests; both projects and root typecheck exit 0 with existing strict settings; fake adapter unit/contract assertions still execute without skips masking failures.

## Done Definition
Record file counts, commands, failures and limitations. Previous reports remain historical evidence and are not silently rewritten.

## Risks
Empty or partial compiler scans can falsely report passing type safety; type assertions used in test fixtures must not weaken production validation.

## Output Required
docs/verification/reports/phase-007-task-738.md
