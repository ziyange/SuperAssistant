# Delivery control

Delivery truth is split between the [roadmap](roadmap.md), one plan per phase, and narrowly scoped [Task Packs](tasks/README.md). Product and engineering facts remain authoritative over a Task Pack; a pack may narrow scope but may not redefine a requirement or ADR.

## Lifecycle states

`planned → ready → active → verifying → accepted → archived`

A phase becomes `ready` only when its Task Packs are complete, approved, and validated. Only one delivery phase is active. A phase becomes `accepted` only after every required pack passes and the current facts reflect the delivered behavior. Archive is allowed only after the next phase's packs are approved.

## Current state

| Phase | State | Pack readiness |
|---|---|---|
| PHASE-000 | accepted | TASK-000 completed locally; initial publication is an S21 handoff |
| PHASE-001 | archived | TASK-100–106 PASS; archive and PHASE-002 handoff recorded |
| PHASE-002 | active | TASK-201–202 complete locally; TASK-202 real-smoke exception; TASK-203–204 approved |
| PHASE-003–007 | planned | phase contracts fixed; packs created in the preceding phase |

See [archive rules](../archive/README.md) and the [quality gate](../verification/quality-gate.md).
