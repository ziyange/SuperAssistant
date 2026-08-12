# TASK-204: Integrate, write back, and close PHASE-002

## Status

DRAFT

PHASE: PHASE-002

MAX_ITERATIONS: 4

user_confirmed: true

## Requirement IDs

REQ-003, REQ-008, REQ-009, REQ-013, REQ-020, REQ-021, REQ-022, REQ-023, REQ-024, REQ-025, REQ-026, REQ-027, REQ-028, REQ-029, REQ-030, REQ-031, REQ-032, REQ-033, REQ-034, REQ-035, REQ-036, REQ-037, REQ-038, REQ-039, REQ-046, REQ-047, REQ-090, REQ-091, REQ-093, REQ-094, REQ-096, REQ-097, REQ-098, REQ-099

## Objective

Integrate accepted TASK-201 through TASK-203 evidence, prove the deterministic
single-Task authorization-to-Artifact loop, write current facts back, prepare
PHASE-003 Packs, and archive PHASE-002 without widening authority.

## Context Pack

- `docs/delivery/phase-002.md`
- `docs/verification/quality-gate.md`
- `docs/archive/README.md`
- `docs/decisions/ADR-005-rolling-task-packs.md`

## Must Read

- `AGENTS.md`
- `docs/product.md`
- `docs/requirements.md`
- `docs/requirement-traceability-matrix.md`
- `docs/architecture.md`
- `docs/data-model.md`
- `docs/security.md`
- `docs/api/sai.md`
- `docs/adapters/codex.md`
- `docs/orchestration.md`
- `docs/operations.md`
- `docs/ux.md`
- `docs/delivery/phase-002.md`
- `docs/delivery/tasks/TASK-201.md`
- `docs/delivery/tasks/TASK-202.md`
- `docs/delivery/tasks/TASK-203.md`
- `docs/verification/test-strategy.md`
- `docs/verification/scenarios.md`

## Allowed Files

- AGENTS.md
- docs/README.md
- docs/product.md
- docs/requirements.md
- docs/requirement-traceability-matrix.md
- docs/architecture.md
- docs/data-model.md
- docs/security.md
- docs/api/sai.md
- docs/adapters/codex.md
- docs/orchestration.md
- docs/operations.md
- docs/ux.md
- docs/delivery/README.md
- docs/delivery/roadmap.md
- docs/delivery/phase-002.md
- docs/delivery/phase-003.md
- docs/delivery/tasks/README.md
- docs/delivery/tasks/TASK-204.md
- docs/delivery/tasks/TASK-301.md
- docs/delivery/tasks/TASK-302.md
- docs/delivery/tasks/TASK-303.md
- docs/delivery/tasks/TASK-304.md
- docs/delivery/tasks/TASK-305.md
- docs/verification/reports/phase-002-task-204.md
- docs/archive/phase-002/README.md
- docs/archive/phase-002/task-pack-snapshots.md
- docs/archive/phase-002/verification-evidence.md
- docs/archive/phase-002/acceptance-record.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json

## Forbidden Files

- Any file not explicitly listed in Allowed Files.
- Production source, package manifests, dependency locks, SQL migrations,
  credentials, remote configuration, Git refs, or earlier archive evidence.

## Interfaces / Contracts

- A `READ_ONLY` goal creates neither ProposalVersion nor Grant.
- A side effect requires an immutable current ProposalVersion, exactly one
  Grant, fresh preflight, one Attempt identity, valid fencing, and worktree.
- Unknown execution is reconciled rather than redispatched; cancellation ends
  only after process termination and lease release.

## Data Constraints

- Use deterministic fake evidence only; do not create a real Proposal, Grant,
  execution, external Artifact, or project mutation during closeout.
- Keep provider-native identifiers and raw unsafe output inside adapter
  boundaries; all renderer evidence stays product-neutral and sanitized.
- Archive copies supplement current facts and do not replace them.

## UI Constraints

- Evidence confirms Task Center states, cancellation/reconciliation labels, and
  Artifact viewers remain sanitized and provider-neutral.

## Implementation Requirements

- Run the deterministic end-to-end evidence suite against the accepted packs.
- Write back only observed behavior, snapshot approved Packs, and do not
  archive until PHASE-003 Pack readiness is proven.

## Test Requirements

```powershell
npm run lint
npm run typecheck
npm run test:unit
npm run test:contract
npm run test:e2e
npm run build
python scripts/check_docs_links.py docs --json
python scripts/check_traceability.py --requirements docs/requirements.md --matrix docs/requirement-traceability-matrix.md --json
python scripts/check_schemas.py references/schemas --json
python scripts/verify_runtime_trace.py --mode build --task-pack docs/delivery/tasks/TASK-204.md --schemas references/schemas.md --next-iteration 1 --json
git diff --check
```

## Acceptance Criteria

- TASK-201–203 each have `PASS` reports and their exact scenarios pass.
- Fake E2E proves no pre-confirmation effect, one duplicate-confirmation
  Attempt, stale-preflight blocking, no restart duplication, and cancellation
  process/lease release.
- Artifact evidence is immutable, checksummed, attributable, and safe to view.
- TASK-301–305 validate, are formally approved, and have `user_confirmed: true`.
- Archive records packs, gates, ADRs, commits, risks, and PHASE-003 readiness.

## Done Definition

PHASE-002 is accepted and archived only when every acceptance criterion and
command above passes. Otherwise this Pack records `BLOCKED` with exact gaps
and creates no archive.

## Risks

`SECURITY_PERMISSION 0.600` remains active. Ambiguous results enter
reconciliation and are never retried by closeout. Runtime-trace exit 1, 3, 5,
or 6 stops archival; exit 2 or 4 follows the documented scope/transaction
recovery dispatch before a fresh gate.

## Output Required

Return the PHASE-002 acceptance decision, report/archive paths, pack approval
proof, command evidence, skipped checks, known issues, and PHASE-003 entry.
