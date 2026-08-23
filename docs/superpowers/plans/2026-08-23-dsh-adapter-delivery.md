# DSH Adapter Delivery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the blocked Gemini delivery path with a locally hosted, externally invoked DeepSeek Harness Adapter that preserves SAI's durable control-plane guarantees.

**Architecture:** `packages/dsh-adapter` owns a process-per-Attempt DSH JSON-RPC host and converts DSH notifications into normalized SAI events. SQLite remains the source of truth for Attempt status, result, event sequence, grants, leases, and reconciliation. The separate DSH workspace at `E:\Programs\deepseek-harness` is only invoked through its public SDK/protocol and is never modified.

**Tech Stack:** Electron/Node 22, TypeScript, Vitest, SQLite, DSH SDK JSON-RPC over stdio, local Git worktrees.

**Spec:** `docs/superpowers/specs/2026-08-23-dsh-adapter-design.md`

## Global Constraints

- DSH workspace: `E:\Programs\deepseek-harness`, currently commit `141eb6fef83422698aef7a981029e843e8161534` and SDK protocol `0.1.0-rc.8`.
- Never modify, vendor, fork, or write under the DSH workspace.
- Every Attempt gets one DSH process, one session root, and one task worktree.
- SQLite and the Super Assistant journal, never DSH conversation state, own SAI `status`, `events`, `result`, and reconciliation truth.
- DSH Shell, filesystem, network, and plugin operations require a pinned Function, immutable Proposal, current Grant, current Project snapshot, Lease fence, and broker audit record.
- A DSH protocol mismatch, lost process, event gap, unreadable session log, or ambiguous interval is `UNKNOWN/RECONCILING`; it never permits redispatch.
- No probe uses a credential, model call, network call, plugin installation, or unbrokered filesystem/shell side effect.

---

### Task 1: Supersede the Gemini delivery decision

**Files:**
- Create: `docs/decisions/ADR-007-external-dsh-adapter.md`
- Modify: `docs/decisions/README.md`
- Modify: `docs/architecture.md`
- Modify: `docs/api/sai.md`
- Modify: `docs/operations.md`
- Modify: `docs/delivery/phase-006.md`
- Modify: `docs/requirements.md`
- Modify: `docs/requirement-traceability-matrix.md`
- Modify: `docs/delivery/tasks/README.md`
- Modify: `docs/delivery/tasks/TASK-607.md`

**Interfaces:**
- Consumes: SAI eight-operation contract and DSH Adapter design.
- Produces: `DSH Adapter` as PHASE-006's required second adapter; Gemini TASK-607 is rejected without changing SAI semantics.

- [ ] **Step 1: Write the decision assertions before implementation.**

Record that DSH process observations are non-authoritative and that DSH's lack of prompt cancel/result is bridged by process-per-Attempt ownership plus journal-derived `UNKNOWN/RECONCILING` behavior.

- [ ] **Step 2: Create ADR-007.**

Use sections `Context`, `Decision`, `Alternatives rejected`, `Consequences`, and `Compatibility`. State that `TASK-607` is superseded because Gemini Core cannot provide the required durable adapter surface; it is not a failure of the product-neutral SAI contract.

- [ ] **Step 3: Update active engineering facts.**

Replace Gemini-specific second-adapter language with DSH's public stdio JSON-RPC profile, process-per-Attempt lifecycle, journal bridge, brokered capability policy, and drift gate.

- [ ] **Step 4: Update delivery facts.**

Replace the executable Gemini adapter Task with `TASK-610` DSH probe and reserve `TASK-611` for a production DSH Adapter only after the probe passes. Map REQ-077 through REQ-079 to the new work.

- [ ] **Step 5: Verify facts.**

Run: `python scripts/check_docs_links.py docs --json` and `python scripts/check_traceability.py --requirements docs/requirements.md --matrix docs/requirement-traceability-matrix.md --json`.

- [ ] **Step 6: Commit.**

```powershell
git add docs/decisions docs/architecture.md docs/api/sai.md docs/operations.md docs/delivery docs/requirements.md docs/requirement-traceability-matrix.md
git commit -m "docs(phase-006): adopt external DSH adapter"
```

### Task 2: Create the DSH compatibility-probe Task Pack

**Files:**
- Create: `docs/delivery/tasks/TASK-610.md`
- Modify: `docs/delivery/tasks/README.md`
- Create: `docs/verification/reports/phase-006-task-610.md`

**Interfaces:**
- Consumes: ADR-007 and DSH design.
- Produces: an exact allowlist for probe code and configuration; no production Adapter authorization.

- [ ] **Step 1: Define the exact probe surface.**

Require public DSH launch, `initialize`, one synthetic malformed-frame test, session-event normalization fixture, process shutdown ladder fixture, drift rejection, and capability declaration checks. Explicitly exclude real model/provider calls and any side effect.

- [ ] **Step 2: List each permitted file.**

Authorize only root dependency metadata if a local file reference is necessary, `packages/dsh-adapter/src/dsh-probe.ts`, `packages/dsh-adapter/tests/dsh-probe.test.ts`, `packages/dsh-adapter/fixtures/probe.cordis.yml`, the DSH docs/ADR/report, and no broad paths.

- [ ] **Step 3: Set acceptance.**

The probe passes only when it identifies the exact DSH runtime, rejects profile/protocol drift, does not issue a provider call, and produces deterministic evidence for every eight-operation mapping. Missing proof produces a completed-but-blocked report and forbids TASK-611.

- [ ] **Step 4: Validate pack.**

Run: `python scripts/check_task_pack.py docs/delivery/tasks/TASK-610.md --schemas references/schemas.md --json`.

- [ ] **Step 5: Commit.**

```powershell
git add docs/delivery/tasks/TASK-610.md docs/delivery/tasks/README.md docs/verification/reports/phase-006-task-610.md
git commit -m "docs(phase-006): authorize DSH compatibility probe"
```

### Task 3: Implement and verify the no-side-effect DSH probe

**Files:**
- Create: `packages/dsh-adapter/package.json`
- Create: `packages/dsh-adapter/tsconfig.json`
- Create: `packages/dsh-adapter/src/dsh-probe.ts`
- Create: `packages/dsh-adapter/tests/dsh-probe.test.ts`
- Create: `packages/dsh-adapter/fixtures/probe.cordis.yml`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `docs/adapters/dsh.md`
- Modify: `docs/verification/reports/phase-006-task-610.md`

**Interfaces:**
- Consumes: `DshProbeConfig { repositoryPath, expectedCommit, expectedProtocolVersion, runtimeCommand, runtimeArgs }`.
- Produces: `probeDsh(config): Promise<DshProbeResult>` where `DshProbeResult` contains runtime identity, protocol identity, feature observations, and fail-closed reasons.

- [ ] **Step 1: Write failing tests.**

Cover a matching local identity, a commit mismatch, protocol mismatch, malformed JSON frame, disallowed configured tool, and shutdown timeout that proves the process is reaped before a passing cancellation observation.

- [ ] **Step 2: Run the focused tests.**

Run: `npx vitest run --project unit packages/dsh-adapter/tests/dsh-probe.test.ts`.

Expected: failure because `probeDsh` does not exist.

- [ ] **Step 3: Implement the minimal probe.**

Read only Git identity and public SDK/protocol metadata from the configured DSH path. Spawn only a fixture JSON-RPC process with no DSH model provider. Validate newline JSON framing, initialize identity, and terminate using close/EOF/terminate/kill evidence. Do not invoke `dsh`, a model, or a capability tool.

- [ ] **Step 4: Run focused verification.**

Run: `npx vitest run --project unit packages/dsh-adapter/tests/dsh-probe.test.ts`.

Expected: all probe scenarios pass.

- [ ] **Step 5: Run task and repository gates.**

Run: `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run test:contract`, `npm run test:e2e`, `npm run build`, then the documented Python governance gate order.

- [ ] **Step 6: Record the capability matrix and commit.**

```powershell
git add package.json package-lock.json packages/dsh-adapter docs/adapters/dsh.md docs/verification/reports/phase-006-task-610.md
git commit -m "test(phase-006): prove local DSH compatibility profile"
```

### Task 4: Gate production DSH Adapter implementation

**Files:**
- Create: `docs/delivery/tasks/TASK-611.md`
- Create: `docs/verification/reports/phase-006-task-611.md`
- Modify: `docs/delivery/tasks/README.md`

**Interfaces:**
- Consumes: a passing `DshProbeResult` and ADR-007.
- Produces: an approved or rejected exact implementation pack for the production DSH Process Host, Event Journal Bridge, Tool Broker, and Reconciler.

- [ ] **Step 1: Read the completed probe evidence.**

Refuse to draft an approved implementation pack unless all Task 3 acceptance criteria have current evidence.

- [ ] **Step 2: Create exact production boundaries.**

Enumerate individual source and test files for process ownership, event normalization, broker authorization, cancellation, and reconciliation. Include all affected data/SAI/operations docs and no catch-all directory path.

- [ ] **Step 3: Define production acceptance scenarios.**

Require duplicate start, stale Grant, stale Lease, process crash, event gap, cancel timeout, tool denial, authorized file/shell/network/plugin request, restart recovery, and no-redispatch proof.

- [ ] **Step 4: Validate and commit.**

Run: `python scripts/check_task_pack.py docs/delivery/tasks/TASK-611.md --schemas references/schemas.md --json`, then commit with `docs(phase-006): prepare production DSH adapter pack`.

## Plan self-review

- Spec coverage: Task 1 establishes external ownership and SAI invariants; Task 2 bounds the probe; Task 3 proves the local DSH profile without provider or tool effects; Task 4 gates production capabilities and recovery behavior.
- Placeholder scan: no unresolved delivery step, wildcard allowlist, or unassigned acceptance criterion is present.
- Type consistency: `DshProbeConfig` and `DshProbeResult` are defined in Task 3 and are the only probe types used later.
