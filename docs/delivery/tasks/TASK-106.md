# TASK-106: Integrate, write back, and close PHASE-001

## Status

APPROVED

PHASE: PHASE-001

MAX_ITERATIONS: 3

user_confirmed: true

## Requirement IDs

REQ-001, REQ-002, REQ-005, REQ-006, REQ-007, REQ-010, REQ-014, REQ-015, REQ-017, REQ-018, REQ-019, REQ-028, REQ-029, REQ-031, REQ-090, REQ-091, REQ-092, REQ-094, REQ-097, REQ-098, REQ-099

## Objective

Integrate accepted TASK-101 through TASK-105 evidence, run the PHASE-001 acceptance suite, write actual behavior back to current facts, revise and approve the PHASE-002 packs including a closeout pack, and create the PHASE-001 archive without implementing a side-effecting Codex operation.

## Context Pack

- `docs/delivery/phase-001.md`
- `docs/verification/quality-gate.md`
- `docs/archive/README.md`
- `docs/decisions/ADR-005-rolling-task-packs.md`

## Must Read

- `AGENTS.md`
- `docs/README.md`
- `docs/product.md`
- `docs/requirements.md`
- `docs/requirement-traceability-matrix.md`
- `docs/architecture.md`
- `docs/data-model.md`
- `docs/security.md`
- `docs/api/sai.md`
- `docs/adapters/codex.md`
- `docs/operations.md`
- `docs/delivery/phase-001.md`
- `docs/delivery/tasks/TASK-101.md`
- `docs/delivery/tasks/TASK-102.md`
- `docs/delivery/tasks/TASK-103.md`
- `docs/delivery/tasks/TASK-104.md`
- `docs/delivery/tasks/TASK-105.md`
- `docs/verification/test-strategy.md`
- `docs/verification/scenarios.md`

## Allowed Files

- AGENTS.md
- docs/README.md
- docs/architecture.md
- docs/data-model.md
- docs/security.md
- docs/api/sai.md
- docs/adapters/codex.md
- docs/orchestration.md
- docs/operations.md
- docs/ux.md
- docs/product.md
- docs/requirements.md
- docs/requirement-traceability-matrix.md
- docs/delivery/README.md
- docs/delivery/roadmap.md
- docs/delivery/phase-001.md
- docs/delivery/phase-002.md
- docs/delivery/tasks/README.md
- docs/delivery/tasks/TASK-106.md
- docs/delivery/tasks/TASK-201.md
- docs/delivery/tasks/TASK-202.md
- docs/delivery/tasks/TASK-203.md
- docs/delivery/tasks/TASK-204.md
- docs/verification/reports/phase-001-task-106.md
- docs/archive/phase-001/README.md
- docs/archive/phase-001/task-pack-snapshots.md
- docs/archive/phase-001/verification-evidence.md
- docs/archive/phase-001/acceptance-record.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- apps/desktop/tests/main/worktree-service.test.ts

## Forbidden Files

- Any file not explicitly listed in Allowed Files.
- Any production application source, package manifest, dependency lockfile, SQL migration, secret, credential, remote configuration, or Git object/ref/index/log file.
- Any source-evidence or previous archive file.

## Interfaces / Contracts

- Confirm that PHASE-001 exposes read-only discovery only and that `start`, `resume`, and `cancel` fail closed.
- Review, revise if evidence requires it, and approve PHASE-002 Task Packs for Proposal, Grant, preflight, execution, cancellation, reconciliation, Task UI, and immutable Artifact evidence.

## Data Constraints

- Preserve all migration, Project, Agent, capability, worktree, and discovery evidence.
- Do not create a Proposal, Grant, Task execution, Codex mutation, or Artifact content through this closeout pack.
- Archive copies supplement, never replace, active product and engineering truth.

## UI Constraints

- Verify onboarding, five primary navigation destinations, Project Center, and Agent Center read-only discovery.
- No Proposal confirmation or execution control is exposed as reachable behavior.

## Implementation Requirements

- Run the complete PHASE-001 test/contract/security/migration/worktree evidence set against accepted task commits.
- Update facts only from observed evidence, preserve limitations and known issues, and produce PHASE-001 archive records.
- Create TASK-204 with exact files and tests for PHASE-002 integration/closeout; revise TASK-201–203 rather than editing approved historical copies in place.
- Mark PHASE-001 accepted then archived only after PHASE-002 TASK-201–204 all validate and are approved.

## Test Requirements

- `npm run lint`
- `npm run typecheck`
- `npm run test:unit`
- `npm run test:contract`
- `npm run test:e2e`
- `npm run build`
- `python scripts/check_docs_links.py docs --json`
- `python scripts/check_traceability.py --requirements docs/requirements.md --matrix docs/requirement-traceability-matrix.md --json`
- `python scripts/check_schemas.py references/schemas --json`
- `python scripts/verify_runtime_trace.py --mode build --task-pack docs/delivery/tasks/TASK-106.md --schemas references/schemas.md --next-iteration 1 --json`
- `git diff --check`

## Acceptance Criteria

- TASK-101–105 all have PASS reports and their exact acceptance criteria are proven.
- No executable PHASE-001 path can issue a side-effecting Codex operation.
- Project/worktree isolation, restart-safe persistence, secret redaction, and read-only discovery evidence are current.
- TASK-201–204 validate and are APPROVED with user confirmation.
- Archive contains summary, snapshots, verification evidence, acceptance record, ADR references, commits, risks, and PHASE-002 readiness.

## Done Definition

PHASE-001 is accepted and archived only after all listed acceptance criteria and local gates pass. Otherwise TASK-106 reports BLOCKED with exact missing evidence and does not archive.

## Risks

- Critical: treating an untested discovery path as safe execution. Mitigate with fail-closed checks and contract fixtures.
- High: archiving without approved PHASE-002 packs. Mitigate with structural validation and explicit human confirmation.
- High: archive drift. Mitigate with snapshots and current-fact writeback.
- Medium: Windows Git worktree setup can exceed Vitest's default five-second
  test timeout under local load. This Pack permits only an explicit per-test
  fifteen-second deadline; isolation assertions and implementation remain
  unchanged.

## Output Required

- PHASE-001 acceptance decision, report paths, archive index, commits, test results, skipped checks, known issues, and PHASE-002 readiness proof.
