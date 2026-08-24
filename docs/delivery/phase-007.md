# PHASE-007: Team and enterprise governance

- State: Reopened — integrated enterprise delivery required
- Horizon: H3 completion
- Branch family: `codex/phase-007-*`
- Archive path: `docs/archive/phase-007/`

## Goal

Add a multi-user Workspace governance plane with membership, RBAC, multi-party approval, per-principal credential isolation, audit export, and enforceable data-retention policies.

## Requirements

Primary scope is the team and enterprise portion of `REQ-070–089` and every applicable `REQ-090–099` control.

## Dependencies

Stable domain platform, generic OIDC Authorization Code plus PKCE identity decision, self-hosted Team Service/PostgreSQL authority ADR, enterprise threat model, retention/legal policy, and approved PHASE-007 packs.

## Scope

- Workspace membership, roles, groups, and least-privilege policy evaluation.
- Separation of requester, approver, operator, auditor, and administrator duties.
- Multi-party approval policies bound to immutable Proposal versions.
- User/service credential namespaces and non-transferable grant context.
- Complete audit export with integrity validation and access logging.
- Retention, legal hold, export, and deletion workflows with evidence.
- Self-hosted Team Service over HTTPS JSON commands/queries and SSE events; Team Workspace PostgreSQL authority with local SQLite cache only.

## Non-goals

No hidden administrator bypass, shared plaintext credentials, retroactive audit mutation, or automatic cross-organization trust.

## Interface impact

Every command and event gains actor and tenant/workspace context under a backward-compatible envelope version. Authorization evaluates role, resource, action, Proposal version, approver quorum, and credential owner. Retention policies govern all evidence types without breaking required audit holds.

## Risks and controls

- Privilege escalation: deny-by-default RBAC and negative authorization tests.
- Approval collusion or replay: quorum, separation-of-duty, immutable grant binding, and nonce/idempotency controls.
- Cross-user credential leak: OS-backed namespaces and process isolation.
- Incomplete deletion or audit: data inventory, retention state machine, legal hold, and export checksums.

## Test strategy

Role-matrix property tests, cross-tenant negative tests, concurrent approval/idempotency tests, credential-isolation process tests, audit completeness/export verification, retention clock tests, legal-hold tests, and enterprise Playwright flows.

## Reopening disposition

TASK-709 rejected an H3 completion claim because the first PHASE-007 Packs
proved isolated rules rather than an integrated enterprise control plane. The
recovery sequence in [PHASE-007 integration recovery](phase-007-integration-recovery.md)
is now the only execution route to acceptance. `TASK-709` is historical
non-acceptance evidence; it does not authorize archive or release.

## Entry conditions

PHASE-006 accepted; identity/RBAC and data-governance ADRs approved; enterprise security review complete; packs approved.

## Exit conditions

- Role isolation is proved by positive and negative matrices.
- Required actions enforce multi-party approval and separation of duties.
- Credentials cannot cross principal or Workspace boundaries.
- Audit export is complete, integrity-verifiable, and access-controlled.
- Retention and legal-hold rules produce deterministic evidence.
- Active facts, operational runbooks, long-term roadmap, and H3 maintenance handoff are accepted; PHASE-007 has no PHASE-008 Task Pack prerequisite.

## Archive evidence

Archive enterprise acceptance, threat model, authorization matrices, approval recordings, credential tests, audit exports/checksums, retention/legal-hold evidence, pack snapshots, commits, known issues, and the H3 completion statement.
