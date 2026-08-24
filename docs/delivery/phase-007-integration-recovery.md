# PHASE-007 integration recovery

- State: `REOPENED — integration delivery required`
- Authority: TASK-709 rejected the previous H3 acceptance claim on 2026-08-24.
- Target: H3 is not accepted until this recovery sequence and its evidence pass.

## Why the phase was reopened

TASK-701–708 supplied independently tested rules and small services. They did
not prove a PostgreSQL-backed Team authority, a real identity/session boundary,
authorization at every API/data boundary, durable approval/credential/audit
workflows, an Electron Team experience, or a production-level recovery suite.
Those facts are recorded in the immutable TASK-709 acceptance audit.

## Integrated delivery sequence

| Pack | Scope | Requirements | Required proof |
|---|---|---|---|
| TASK-711 | PostgreSQL Team authority and typed HTTPS JSON/SSE API | REQ-081, 090, 096, 099 | Team-only authority, transactional persistence, API command/query/stream, migration and restore rehearsal |
| TASK-712 | OIDC PKCE, sessions and membership | REQ-081, 090, 094, 099 | Fixture issuer/JWKS rotation, PKCE/state/nonce/audience checks, secure session and invitation flow |
| TASK-713 | Unified authorization, RBAC, credentials and approvals | REQ-082–084, 094–096, 099 | Middleware on every protected route, durable role/grant/quorum records and 200 negative cases |
| TASK-714 | Complete audit export and retention/legal-hold operations | REQ-085, 086, 096, 099 | Governed inventory, access-checked export, tamper proof, retention plan/execution and backup/restore evidence |
| TASK-715 | Electron Team Workspace governance workflows | REQ-081–086, 089, 098 | Accessible Workspace/member/role/approval/audit/retention flows using Team API only |
| TASK-716 | Durable governed notifications | REQ-087–089, 094, 096, 099 | Persisted preferences/outbox, bounded channel delivery, retry/idempotency and reauthorized deep links |
| TASK-717 | H3 system acceptance | REQ-081–089, 090, 096, 099 | API/database/UI E2E, recovery, threat/security, performance, PostgreSQL target-version and backup evidence |
| TASK-718 | Truthful H3 closeout | all H3 gate requirements | Only after TASK-711–717 pass: fact writeback, archive and maintenance handoff |

## Non-negotiable recovery gates

1. PostgreSQL 16.4 is a local compatibility fixture only. The H3 deployment
   target remains PostgreSQL 17.x and must have separate evidence before
   acceptance.
2. Every Team API command, query and SSE subscription must authenticate and
   authorize actor/workspace/resource context before loading protected data.
3. Team-mode SQLite is cache only; it cannot accept commands, resolve grants or
   become authority during a PostgreSQL outage.
4. OIDC failures, stale sessions, ambiguous permission state and unknown
   external outcomes fail closed. They never fall back to cached authority.
5. Every multi-party Grant is transactional, binds an immutable Proposal digest,
   contains distinct eligible approvers, and is consumed exactly once.
6. No H3 archive, release, merge or remote action is authorized by this plan.

## Acceptance matrix

The authoritative traceability matrix retains the original REQ and SCN IDs.
TASK-711–718 add execution mappings; a test passing at one layer cannot stand
in for a missing API, persistence or UI-layer proof.
