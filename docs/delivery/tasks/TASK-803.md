# TASK-803: Browser regression for review-only goal entry

## Status
APPROVED
PHASE: PHASE-007
MAX_ITERATIONS: 3
user_confirmed: true
Authority: user requested continued development and actual pre-merge testing, while deferring real Electron sandbox verification.

## Requirement IDs
REQ-008, REQ-020, REQ-021, REQ-022, REQ-024, REQ-090, REQ-094

## Objective
Run the existing browser UI regression suite and add a focused browser test for the new review-only goal input.

## Context Pack
- docs/delivery/tasks/TASK-798.md
- docs/delivery/tasks/TASK-800.md
- docs/delivery/tasks/TASK-801.md

## Must Read
- AGENTS.md
- docs/README.md
- docs/requirements.md
- docs/security.md
- docs/ux.md
- docs/verification/quality-gate.md

## Allowed Files
- docs/delivery/tasks/TASK-803.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- .github/workflows/docs-gates.yml
- apps/desktop/tests/e2e/proposal-confirmation.spec.ts
- docs/verification/reports/phase-007-task-803.md

## Forbidden Files
Other application files, archives, existing user data, other worktrees, main, remote Git operations, real Codex execution and Electron sandbox verification.

## Interfaces / Contracts
The browser test supplies a clearly identified fake preload API. It can establish renderer behavior only and must not be described as exercising Electron main, native review, execution, authorization or sandboxing.

## Data Constraints
Use synthetic goals and no actual credentials. Browser installation, if needed, uses the project's pinned Playwright tool and standard user cache; do not overwrite user data or change package lock.

## UI Constraints
The renderer must submit only Project ID, bounded goal and criterion, present the fixed scope, display REVIEWED_ONLY accurately, and never imply execution authorization.

## Implementation Requirements
Add a browser test for form input, fake draft/review invocation, sensitive scope text and no enabled execution confirmation. Run the complete existing browser suite and record exact failures, skips and environment. Do not replace genuine Electron acceptance with this result.

## Test Requirements
Run production build, the focused browser scenario and complete Playwright suite with nonzero discovery and no skips; then governance checks. If browser binaries are unavailable, record BLOCKED and continue independent work.

## Acceptance Criteria
The focused scenario and full browser suite pass without skips; evidence labels all preload/IPC behavior as faked and Electron sandbox as deferred.

## Done Definition
Report actual browser version, commands, results and remaining real Electron integration gaps.

## Risks
Playwright-managed browser is separate from the packaged Electron runtime; successful browser tests cannot establish Electron security or main-process integration.

## Output Required
Browser test and verification report.

### Local result — 2026-11-22

The focused fake-preload browser scenarios passed 2/2, and the complete
Playwright browser suite passed 9/9 without skips on Chromium headless shell
140.0.7339.16. Build, lint and typecheck passed. This is not real Electron
main-process, native review or sandbox evidence. See the
[browser report](../../verification/reports/phase-007-task-803.md).
