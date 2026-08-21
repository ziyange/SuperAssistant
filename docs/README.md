# Super Assistant documentation

This repository contains accepted document-first baselines for `PHASE-000`,
`PHASE-001` and `PHASE-002`. `PHASE-003` is next for Decision, audit and
recovery implementation.

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
- TASK-301–305 are approved and PHASE-003 is the next implementation phase.

## Design and implementation plans

- [Lifecycle design](superpowers/specs/2026-08-09-super-assistant-lifecycle-design.md)
- [Document-first initialization plan](superpowers/plans/2026-08-09-super-assistant-doc-first-initialization.md)

## Change rule

A change starts with the narrowest relevant fact source, then updates requirements and traceability, then creates or revises a Task Pack. Code must never be used to discover an unstated product decision after implementation has begun. New evidence may revise the plan, but the decision and impact must be written before dependent implementation proceeds.
