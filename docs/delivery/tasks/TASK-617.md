# TASK-617: PHASE-006 DSH acceptance and archive correction

## Status

COMPLETED
PHASE: PHASE-006
MAX_ITERATIONS: 3
user_confirmed: true

## Requirement IDs

REQ-070, REQ-071, REQ-072, REQ-077, REQ-078, REQ-079, REQ-080, REQ-090,
REQ-091, REQ-093, REQ-095, REQ-096, REQ-098, REQ-099

## Objective

Reconcile PHASE-006 execution facts after the accepted DSH supersession of the
Gemini production-adapter path, record local acceptance and archive evidence,
and preserve the exact approved PHASE-007 handoff. This Pack authorizes only
delivery-document writeback and archive work; it authorizes no PHASE-007 code.

## Context Pack

- docs/decisions/ADR-007-external-dsh-adapter.md
- docs/verification/reports/phase-006-task-606.md
- docs/verification/reports/phase-006-task-611.md
- docs/archive/README.md

## Implementation Requirements

- Reconcile only current delivery facts; preserve the Gemini probe as historical
  rejected evidence and record the DSH supersession explicitly.
- Write an immutable local archive with task digest, gate, limitation and
  PHASE-007 handoff evidence.
- Do not claim real DSH capability execution or remote CI evidence.

## Done Definition

The current phase, roadmap, Task registry and archive agree that PHASE-006
passed locally; all prerequisite PHASE-007 Packs remain approved and unchanged.

## Must Read

- AGENTS.md
- docs/README.md
- docs/delivery/roadmap.md
- docs/delivery/phase-006.md
- docs/delivery/phase-007.md
- docs/delivery/tasks/README.md
- docs/delivery/tasks/TASK-606.md
- docs/delivery/tasks/TASK-607.md
- docs/delivery/tasks/TASK-609.md
- docs/delivery/tasks/TASK-611.md
- docs/delivery/tasks/TASK-612.md
- docs/delivery/tasks/TASK-613.md
- docs/delivery/tasks/TASK-614.md
- docs/delivery/tasks/TASK-615.md
- docs/delivery/tasks/TASK-616.md
- docs/decisions/ADR-007-external-dsh-adapter.md
- docs/archive/README.md
- docs/verification/quality-gate.md

## Allowed Files

- docs/README.md
- docs/delivery/roadmap.md
- docs/delivery/phase-006.md
- docs/delivery/tasks/README.md
- docs/delivery/tasks/TASK-609.md
- docs/delivery/tasks/TASK-617.md
- docs/verification/reports/phase-006-task-609.md
- docs/verification/reports/phase-006-task-617.md
- docs/archive/phase-006/README.md
- docs/archive/phase-006/acceptance-record.md
- docs/archive/phase-006/verification-evidence.md
- docs/archive/phase-006/task-pack-snapshots.md
- docs/archive/phase-006/phase-plan.md
- docs/archive/phase-006/known-issues.md
- docs/archive/phase-006/next-phase-handoff.md

## Forbidden Files

Any file not explicitly listed; all application code; any PHASE-007
implementation; any DSH workspace file; remote Git actions; modifying Gemini
probe evidence; changing an already-completed Task Pack other than the
append-only outcome amendment in TASK-609.

## Interfaces / Contracts

SAI remains eight operations. DSH remains product-level `DISABLED` until a
future authorized Function binds a real Proposal, Grant, immutable Attempt
policy, Worktree and ResourceLease. No archive claim may represent a real DSH
model, credential, Shell, filesystem, network or plugin effect as verified.

## Data Constraints

Archive evidence contains only redacted, reproducible local verification facts;
no secret, raw DSH session, credential, or provider response is copied.

## UI Constraints

No renderer or visible product behavior changes. Current UI truth must continue
to present DSH as disabled until a separately authorized Function is enabled.

## Test Requirements

Run the documented governance order, validate TASK-601 through TASK-617, run
the full local application gate already required by the phase, and record
remote CI as `planned` unless an actual Run URL and conclusion exist.

## Acceptance Criteria

- TASK-601–606, TASK-608–616, and this closeout Pack are `COMPLETED`; TASK-607
  remains `REJECTED` with its immutable Gemini evidence preserved.
- TASK-609 records the DSH supersession as an append-only correction and is
  `PASS` rather than a Gemini-blocked closeout.
- Current documents identify PHASE-006 as archived locally and name the exact
  next executable PHASE-007 Pack.
- Archive evidence records implementation commit `7621d48023c16c780043c8b1e76f93199fdeaa63`, local gates, known limitations, Task Pack digests, and
  PHASE-007 approval prerequisites.

## Risks

Remote CI and a real DSH capability smoke remain unrun. Neither may be
silently converted into passing evidence. Any archive conflict or nonzero
runtime trace leaves PHASE-006 unarchived.

## Output Required

`docs/verification/reports/phase-006-task-617.md` and the exact archive files
listed above.
