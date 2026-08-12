# TASK-100: Freeze platform contracts and open PHASE-001

## Status

COMPLETED

PHASE: PHASE-001

MAX_ITERATIONS: 3

user_confirmed: true

## Requirement IDs

REQ-001, REQ-017, REQ-019, REQ-028, REQ-029, REQ-031, REQ-050, REQ-060, REQ-090, REQ-091, REQ-092, REQ-093, REQ-094, REQ-095, REQ-096, REQ-097, REQ-098, REQ-099

## Objective

Open PHASE-001 in its isolated worktree after freezing the cross-phase execution envelope, H1 lease slice, numeric operating limits, lifecycle-scenario traceability, H3 authority decision, and exact PHASE-001 closeout authority. This pack creates no application code, database migration, dependency manifest, or executable UI.

## Context Pack

- `docs/delivery/phase-001.md`
- `docs/api/sai.md`
- `docs/orchestration.md`
- `docs/decisions/ADR-003-authoritative-state-and-delivery.md`
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
- `docs/orchestration.md`
- `docs/operations.md`
- `docs/delivery/README.md`
- `docs/delivery/roadmap.md`
- `docs/delivery/phase-001.md`
- `docs/verification/quality-gate.md`
- `docs/verification/scenarios.md`
- `references/schemas.md`
- `references/review-gates.md`

## Allowed Files

- AGENTS.md
- docs/README.md
- docs/architecture.md
- docs/data-model.md
- docs/security.md
- docs/api/sai.md
- docs/api/sai-envelope.schema.json
- docs/orchestration.md
- docs/operations.md
- docs/requirements.md
- docs/requirement-traceability-matrix.md
- docs/decisions/README.md
- docs/decisions/ADR-006-team-authority-and-oidc.md
- docs/delivery/README.md
- docs/delivery/roadmap.md
- docs/delivery/phase-001.md
- docs/delivery/phase-007.md
- docs/delivery/tasks/README.md
- docs/delivery/tasks/TASK-100.md
- docs/delivery/tasks/TASK-106.md
- docs/verification/scenarios.md
- docs/verification/reports/phase-001-task-100.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json

## Forbidden Files

- Any file not explicitly listed in Allowed Files.
- Any Electron, React, TypeScript, JavaScript, Node application, SQL migration, package manifest, dependency lockfile, credential, secret, or environment file.
- `docs/source/super-assistant-v3.md`, archive evidence, Git object/ref/index/log files, remote configuration, and CI workflow files.

## Interfaces / Contracts

- Freeze SAI 1.0 `describe`, `health`, `start`, `resume`, `cancel`, `status`, `events`, and `result` envelopes with stable identifiers, version references, authorization binding, Project snapshot, and fencing tokens.
- Freeze canonical Proposal digest, Grant single-use transition, per-Attempt event sequence, unknown-state non-redispatch, and the H1 one-Project/one-Codex/one-required-WorkItem validator.
- Freeze H3 authority ownership: SQLite is authoritative only for Local Workspaces; self-hosted Team Service PostgreSQL is authoritative for Team Workspaces; Electron cache is never authority; OIDC Authorization Code plus PKCE is the identity protocol.

## Data Constraints

- No secret, bearer token, raw credential, Thread/Turn ID, or unrestricted filesystem path enters a product envelope, SQLite, UI, artifact, log, or report.
- Proposal digests use RFC 8785 canonical JSON and a `sha256:` prefix followed by exactly 64 lowercase hexadecimal characters.
- A Grant atomically transitions `ISSUED` to `CONSUMED` once; no second Attempt may be created from the same Grant.
- H1 ResourceLease is one Task worktree lease with monotonically increasing fencing token. Full multi-Agent resource conflict/fairness/deadlock acceptance remains PHASE-004.

## UI Constraints

- No application view or component is created.
- Future product UI exposes neither Codex Thread/Turn nor adapter transport details.
- Connection failure remains higher priority than Availability in any future Agent projection.

## Implementation Requirements

- Correct the invalid `VS-*` scenario prefix statement and add lifecycle scenario coverage to traceability.
- Add a machine-readable SAI envelope schema and link it from engineering facts.
- Record numeric H1 runtime limits, reconciliation, cancellation, retention, and disk-pressure policy.
- Add ADR-006 and update indexes/facts for self-hosted Team Service, PostgreSQL authority, generic OIDC with PKCE, and terminal PHASE-007 archive exception.
- Create TASK-106 with exact limits for PHASE-001 integration, writeback, PHASE-002 pack approval, and archive evidence.
- Update PHASE-001 status without marking any implementation task complete.

## Test Requirements

- `python scripts/check_docs_links.py docs --json`
- `python scripts/check_task_pack.py docs/delivery/tasks/TASK-100.md --schemas references/schemas.md --json`
- `python scripts/check_task_pack.py docs/delivery/tasks/TASK-106.md --schemas references/schemas.md --json`
- `python scripts/check_traceability.py --requirements docs/requirements.md --matrix docs/requirement-traceability-matrix.md --json`
- `python scripts/check_schemas.py references/schemas --json`
- `python -m unittest discover -s tests -v`
- `python scripts/verify_runtime_trace.py --mode plan --task-pack docs/delivery/tasks/TASK-100.md --schemas references/schemas.md --next-iteration 1 --json`
- `git diff --check`

## Acceptance Criteria

- PHASE-001 has one active governance pack, five approved implementation packs, and one approved closeout pack.
- Every listed lifecycle scenario maps to a Phase and a Task Pack state in the traceability matrix.
- The SAI schema accepts required stable envelope fields and rejects secret-bearing/unscoped envelopes through `additionalProperties: false` and required scope fields.
- H1 minimum lease and PHASE-004 complete lease responsibilities are unambiguous in requirements, data model, and orchestration facts.
- H3 authority/identity facts are ADR-backed and do not silently change ADR-003.
- All listed local gates pass and report actual local evidence.

## Done Definition

TASK-100 is PASS when the frozen contracts and Task-106 are validated, the PHASE-001 execution state is current, the Merkle trace passes with Exit 0, and no application file is changed.

## Risks

- Critical: a widened SAI or authority contract can allow unauthorized execution or data split-brain. Mitigate through exact schema, ADR, and fail-closed defaults.
- High: lifecycle scenario ambiguity can produce untested acceptance claims. Mitigate through explicit traceability coverage.
- High: a premature PHASE-002 authority change can invalidate approved packs. Mitigate by retaining those packs as DRAFT until TASK-106 review.

## Output Required

- Changed fact-source paths and frozen-contract summary.
- TASK-100 and TASK-106 validator JSON.
- Link, traceability, schema, unit, runtime-trace, and diff-check outputs.
- Branch/commit and known-risk summary.
