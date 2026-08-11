# ADR-001: Local-first Electron control plane

- Status: Accepted
- Date: 2026-08-09
- Decision owners: Super Assistant product and engineering

## Context

H1 must let one user connect local projects and a local Codex runtime while keeping source code, credentials, task state, approvals, logs, and recovery evidence under local control. The application also needs a desktop experience, durable state when the model or network is unavailable, and a future path to H2 agents and H3 team governance.

## Decision

H1 is an Electron desktop application. The renderer uses React and TypeScript, the main process hosts a Node.js `22.x` modular control plane, and SQLite is the authoritative local database. Python `3.9+` is limited to repository governance and verification tools. The Codex adapter runs as a separate local worker process.

The renderer never accesses SQLite, credentials, the filesystem, or child processes directly. It calls a narrow, typed Electron IPC surface exposed by the preload boundary. The main process owns policy checks and database transactions; adapter workers own upstream protocol translation and process control.

No cloud service, user account, remote execution, remote database, or telemetry upload is required for H1 operation. Network use by an approved Agent remains an explicit side effect governed by an AuthorizationGrant.

## Rejected alternatives

- A hosted web control plane would move repository context and credentials across a network boundary before team tenancy is required.
- A browser-only application cannot safely provide the required local process and worktree control.
- A single Electron process would combine untrusted rendering, durable state, credentials, and process execution in one failure domain.

## Consequences

- SQLite migrations, backups, integrity checks, and crash recovery are first-class operational responsibilities.
- Electron IPC and worker IPC are security boundaries, not convenience APIs.
- The adapter can be restarted without making its in-memory state authoritative.
- H1 packaging targets Windows first while path normalization and protocol contracts remain OS-neutral.

## H1-H3 compatibility

- H1 stores explicit `workspace_id` and `owner_id` even though one local owner is active.
- H2 adds more local or remote Adapter Workers behind SAI without allowing renderer access to them.
- H3 may introduce a hosted control plane and team tenancy only through a superseding deployment ADR. Domain identifiers, versioned envelopes, policy decisions, and audit records remain portable; code must not rely on SQLite row IDs as externally visible identifiers.

## Related facts

- [Architecture](../architecture.md)
- [Security](../security.md)
- [Operations](../operations.md)
