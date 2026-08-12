# ADR-006: Team Workspace authority and generic OIDC identity

- Status: Accepted
- Date: 2026-08-12
- Decision owners: Platform architecture and enterprise governance
- Supersedes: the H3 storage extension in ADR-003 only; ADR-003 remains authoritative for Local Workspace SQLite and at-least-once semantics.

## Context

H3 introduces concurrent Team Workspaces, membership, role-based access, multi-party approval, credential separation, retention, and audit export. A local SQLite file cannot be a shared Team authority, while a client cache cannot publish competing state. Identity must avoid an unreviewed vendor-specific protocol.

## Decision

Local Workspaces retain SQLite as the sole authoritative control plane. Team Workspaces use a self-hosted Node Team Service backed by PostgreSQL 17.x as the sole authoritative control plane. Electron may retain a read cache but never dual-writes, elects authority, or accepts mutation while the Team Service is unavailable.

The Team Service exposes HTTPS JSON commands/queries and an SSE event stream. It binds loopback by default; remote deployment requires trusted TLS, explicit allowlisted origins, and declared host configuration. Identity is generic OpenID Connect Authorization Code with PKCE. Token issuer, audience, expiry, nonce, and PKCE verifier are validated fail-closed.

User credentials remain in the respective Windows Credential Manager namespace. A Team service credential is held by a dedicated Windows service account's Credential Manager; PostgreSQL stores only opaque reference, owner, scope, rotation metadata, and revocation state.

## Rejected alternatives

- Shared SQLite or client-to-client replication creates split-brain authority.
- SQLite/PostgreSQL dual writes make recovery and audit ordering ambiguous.
- Implicit cloud identity or a vendor-specific login couples product authorization to one provider.

## Consequences

- TASK-701 must prove import, checksum/count reconciliation, backup/restore rehearsal, and a single authority cutover before Team Workspace mutations enable.
- Team Service outage is fail-closed for writes while preserving truthful read state; the cache is not promoted.
- H3 RBAC, Approval, Audit, and Retention records carry Workspace/tenant and actor identity without changing prior IDs or SAI operation meanings.

## H1-H3 compatibility

- H1/H2 Local Workspace behavior is unchanged.
- H3 preserves immutable Proposal/Grant/Attempt semantics, at-least-once delivery, per-Attempt sequence, fencing, and unknown-state non-redispatch.
- A future vault or cloud secret manager is an additive credential-broker adapter, not an H3 requirement.

## Related facts

- [Architecture](../architecture.md)
- [Security](../security.md)
- [Data model](../data-model.md)
- [Operations](../operations.md)
- [PHASE-007](../delivery/phase-007.md)
