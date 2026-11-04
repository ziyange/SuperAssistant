# Super Assistant documentation

## Integration recovery status (2026-11-04)

The integration candidate is `codex/task-720-audited`. TASK-720 has completed
its local governance gate; TASK-721 has not yet opened. TASK-716's uncommitted work remains in a separate worktree and is not
part of this candidate. Prior phase archives document historical local decisions,
not proof that the integrated H1–H3 product has passed the new recovery gates.
See [integration baseline](delivery/integration-recovery-baseline.md).

The repository contains historical local phase records through `PHASE-006`.
PHASE-007 has been reopened; the integration recovery gates assess actual
cross-component behavior independently of those historical phase labels.

## Authority map

| Layer | Authority | Purpose |
|---|---|---|
| Source evidence | [Super Assistant V3.0](source/super-assistant-v3.md) and [provenance](source/README.md) | Immutable input and rationale evidence |
| Product truth | [Product](product.md), [requirements](requirements.md), [traceability](requirement-traceability-matrix.md) | What the product must do and how success is proved |
| Engineering truth | [Architecture](architecture.md), [data model](data-model.md), [security](security.md), [SAI](api/sai.md), [Codex adapter](adapters/codex.md), [orchestration](orchestration.md), [UX](ux.md), [operations](operations.md) | How stable behavior and boundaries are designed |
| Decision truth | [ADR index](decisions/README.md) | Locked decisions and supersession history |
| Delivery truth | [Roadmap](delivery/roadmap.md), phase plans, and [Task Packs](delivery/tasks/README.md) | What may be changed now |
| Verification truth | [Quality gate](verification/quality-gate.md), [test strategy](verification/test-strategy.md), and [reports](verification/reports/initial-docs-baseline.md) | Evidence that facts and work agree |
| Archive | [Archive process](archive/README.md) | Immutable phase evidence and handoff proof |

## Current execution

- Completed baseline pack: [TASK-000](delivery/tasks/TASK-000.md).
- Archived application phase: `PHASE-001`; [TASK-106](delivery/tasks/TASK-106.md)
  records closeout and [archive evidence](archive/phase-001/README.md).
- PHASE-002 is archived locally; its [evidence](archive/phase-002/README.md)
  records the user-approved TASK-202 real-smoke exception.
- PHASE-003 is archived locally with its approved real-smoke exception.
- PHASE-004 is archived locally with deterministic multi-agent, fencing and
  quality-loop evidence; its [archive](archive/phase-004/README.md) records
  the inherited real-smoke limitation. PHASE-005 is archived locally with
  bounded monitoring and read-only health evidence. PHASE-006 is archived
  locally with domain, DSH adapter and Artifact-isolation evidence. PHASE-007
  is reopened after TASK-709 rejected unsupported H3 acceptance; see the
  [integration recovery plan](delivery/phase-007-integration-recovery.md).

## Design and implementation plans

- [Lifecycle design](superpowers/specs/2026-08-09-super-assistant-lifecycle-design.md)
- [Document-first initialization plan](superpowers/plans/2026-08-09-super-assistant-doc-first-initialization.md)

## Change rule

A change starts with the narrowest relevant fact source, then updates requirements and traceability, then creates or revises a Task Pack. Code must never be used to discover an unstated product decision after implementation has begun. New evidence may revise the plan, but the decision and impact must be written before dependent implementation proceeds.
