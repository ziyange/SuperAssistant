# Integration architecture and acceptance status

Snapshot: 2026-11-04; based on `4984e02` and the separate, uncommitted
TASK-716 worktree. Solid arrows are connected in the entry point; dashed arrows
represent modules or intended integration, not verified end-to-end capability.

```mermaid
flowchart LR
  UI[React interface] --> IPC[Preload and typed IPC]
  IPC --> Main[Electron main]
  Main --> Reads[Read projections]
  Reads --> SQLite[(SQLite)]
  Main -.-> Execution[Proposal / execution orchestration]
  Execution -.-> Codex[Codex adapter]
  Execution -.-> DSH[DSH adapter]
  Main --> Unavailable[Team unavailable port]
  Main -.-> Team[Team service]
  Team --> Postgres[(PostgreSQL)]
```

```mermaid
flowchart LR
  Goal[Goal] --> Route{Read only?}
  Route -->|yes| Query[Read facts]
  Route -->|no| Proposal[Proposal and confirmation]
  Proposal --> Grant[Grant and preflight]
  Grant --> Attempt[Isolated Attempt]
  Attempt --> Evidence[Artifact and acceptance]
  Attempt -->|ambiguous| Reconcile[Reconcile before retry]
```

The flow above is the intended user contract; current desktop entry points do
not yet demonstrate the complete flow. H1, H2 and H3 integrated acceptance are
not established by historical phase labels.

```mermaid
erDiagram
  Workspace ||--o{ Project : contains
  Workspace ||--o{ Agent : contains
  Agent ||--o{ Function : provides
  Project ||--o{ ProposalVersion : scopes
  ProposalVersion ||--o{ AuthorizationGrant : authorizes
  ProposalVersion ||--o{ Task : defines
  Task ||--o{ WorkItem : contains
  WorkItem ||--o{ ExecutionAttempt : retries
  ExecutionAttempt ||--o{ ResourceLease : owns
  ExecutionAttempt ||--o{ ArtifactVersion : produces
  Task ||--o{ Decision : records
```

ER associations describe the business model; they are not a claim that every
association is enforced by a database foreign key.
