# DSH Adapter design

Status: proposed for user review on 2026-08-23.

## Decision scope

This design replaces the blocked Gemini delivery path in PHASE-006 with a
DeepSeek Harness (DSH) Adapter. Super Assistant owns the Adapter and calls the
locally installed DSH source workspace at `E:\Programs\deepseek-harness`; it
does not modify, vendor, fork, or place product code under that workspace.

The inspected runtime is repository commit
`141eb6fef83422698aef7a981029e843e8161534`, with
`@deepseek-ai/dsh-sdk-client` and `@deepseek-ai/dsh-sdk-protocol` at
`0.1.0-rc.8`. DSH is an independently updating developer-preview runtime.
Its observed JSON-RPC protocol and configuration are compatibility inputs, not
Super Assistant authority.

## Architecture

```text
Super Assistant SQLite control plane
  -> DSH Adapter Worker (packages/dsh-adapter)
    -> DSH process host: one process per ExecutionAttempt
      -> E:\Programs\deepseek-harness JSON-RPC runtime
        -> session.event / session.status notifications
  -> append-only normalized event journal and Artifact metadata
```

The worker launches the existing DSH JSON-RPC runtime using an explicit local
command, argument list, `DSH_CWD`, and `DSH_SESSION_ROOT`. Each Attempt has a
unique child process, controlled session root, task worktree, and environment.
No process is shared between Attempts. The Adapter records the inspected DSH
repository commit, protocol package version, runtime `serverInfo`, launch
digest, session identifier, and session-log digest as nonsecret evidence.

The Worker uses the documented `@deepseek-ai/dsh-sdk-client` public package or
the equivalent newline-delimited JSON-RPC protocol. It does not deep-import DSH
source modules, parse UI text, or rely on CLI/Web internals.

## SAI mapping

| SAI operation | DSH mapping | Authority and failure behavior |
|---|---|---|
| `describe` | inspect installed client/protocol versions and constrained runtime configuration | exposes only a tested, exact compatibility profile |
| `health` | child liveness, initialize response, observation age, stderr health | a stale or failed process is unavailable |
| `start` | launch one process, `initialize`, then `session/prompt` | persist launch and enqueue receipt before accepting the Attempt |
| `resume` | restart a fresh controlled process and reopen the recorded session context when the probe proves replay compatibility | never creates another Attempt |
| `cancel` | request protocol shutdown, then controlled EOF/terminate/kill process-tree ladder | completion requires process exit and Lease release |
| `status` | derive from the SQLite Attempt reducer, child observation, and journal coverage | ambiguous evidence returns `INDETERMINATE` |
| `events` | normalize and journal `session.event` in order | journal is the replay source; DSH log is corroborating evidence |
| `result` | derive a terminal result only from normalized terminal evidence and declared Artifacts | otherwise returns `RESULT_NOT_READY` or reconciliation evidence |

DSH reports whole-agent `session.status`, not a prompt-specific terminal result.
Super Assistant therefore defines an Attempt activity interval as: durable
`session/prompt` receipt through the observed quiescence of its dedicated
process. A process crash, missing sequence, unreadable session log, or unclear
interval is `UNKNOWN/RECONCILING`, never success and never automatic
redispatch.

## Tool and security model

The stock `examples/jsonrpc-agent/cordis.yml` is not permitted in production:
it enables bash, filesystem write/edit, subagents, and persistent session state.
TASK-606R will only inspect it as evidence. Production requires a separate,
Super-Assistant-owned DSH profile/configuration with no direct shell, file,
network, plugin-installation, credential, or UI capability. A later DSH tool
broker exposes only explicitly authorized operations; every requested side
effect re-enters Proposal, Grant, Project snapshot, ResourceLease, and
worktree checks before execution.

`DEEPSEEK_API_KEY` is resolved by a Super Assistant credential broker into the
child process only when a pinned Function requires it. It is excluded from the
database, DSH configuration files, stdout JSON-RPC frames, normal logs,
Artifacts, and reports. The child environment is constructed from an allowlist,
not inherited wholesale.

## Compatibility and update policy

DSH updates do not silently enable a changed runtime. On every DSH commit,
runtime profile, `dsh-sdk-client` version, or protocol `serverInfo.version`
change, the Adapter is `UNAVAILABLE` until an explicit deterministic
compatibility probe passes. The probe proves initialize, prompt receipt,
ordered event ingestion, bounded process shutdown, session-log inspection,
malformed-frame handling, and fail-closed behavior for missing cancellation and
prompt-result protocol operations.

The DSH protocol currently has no version negotiation. Super Assistant accepts
only its configured tested profile and uses the observed runtime version as
evidence; a mismatch is a disabled Adapter, not a fallback.

## Delivery sequence

1. Add a superseding ADR that retires Gemini as the required PHASE-006
   adapter and adopts externally hosted DSH under the above boundary.
2. Revise PHASE-006 and traceability from Gemini-specific delivery to DSH.
3. Create `TASK-606R`, documentation and deterministic DSH probe only.
4. Run the probe against the already installed local DSH workspace without a
   real provider credential or model call.
5. If the probe passes, create a separate production `TASK-607R`; if it fails,
   keep DSH disabled and record exact evidence without weakening SAI.

## Acceptance criteria

- No Super Assistant source change touches `E:\Programs\deepseek-harness`.
- The probe uses an exact local runtime identity and rejects drift.
- No probe fixture exposes a credential or causes a filesystem, shell, network,
  plugin, or model side effect.
- All eight SAI operations have an explicit mapping; the platform, not DSH,
  owns durable status, result, sequence, and reconciliation truth.
- An uncertain DSH interval stays `UNKNOWN/RECONCILING` and prevents
  redispatch.
