# Protected Claim Context Implementation Plan

> **For agentic workers:** Use the existing inline execution method and TASK-826 for audit and exact scope. Complete test-first steps in order.

**Goal:** Replace fixture-supplied execution inputs with a snapshot derived by the protected authority at its original Attempt claim.

**Architecture:** Extend the existing authenticated claim path to return a frozen, fixture-stage snapshot from the Proposal and execution identity it already validates. Retain the old public claim shape and keep production launch and all renderer APIs disabled.

**Tech Stack:** TypeScript, SQLite, Electron main-process modules, Vitest, disposable Git and fake App Server.

**Spec:** `docs/delivery/tasks/TASK-826.md`, `docs/security.md`, and `docs/orchestration.md`.

## Global Constraints

- Only exact TASK-826 allowlisted files; no production route, migration 033 registration, real Codex or Electron sandbox execution.
- Context is an ephemeral snapshot, not confinement, owner provenance or continuing permission to execute.
- Preserve encrypted Proposal storage and original Attempt/Lease semantics.

## Review Focus

- Mutated envelope, grant, project, executable, or fence: fail before a usable claim; exercise stale-authority tests.
- Expired Lease or clock rollback: refuse context; exercise existing lease-negative tests with the new entry point.
- Competing claims: only one immutable result; assert actual Outbox and Attempt state.
- Caller-supplied execution fields: reject the input object before claiming; assert no state mutation.
- Failure after claim or lost fake-server response: retain the original Attempt as UNKNOWN and Lease ACTIVE; assert real SQLite rows.

## Task 1: Bind the context to the claim

**Files:** Modify `apps/desktop/src/main/protected-proposal-authority.ts`; test `apps/desktop/tests/main/protected-proposal-authority.test.ts` and `apps/desktop/tests/main/protected-approval-execution.test.ts`; update TASK-826 and the two specified engineering facts.

**Interfaces:** `claimQueuedContext(scope)` returns a frozen fixture-only object containing `attemptId`, `claimToken`, authenticated `objective`, `baselineCommit`, canonical `projectPath`, `executablePath`, `executableVersion` and `executableSha256`; no caller supplies any of these values. Existing `claimQueued(scope)` continues to return only Attempt and token.

- [x] Write and run a failing test that demands the exact authenticated context and confirms no plaintext is inserted into the database.
- [x] Implement the context using the same verified Proposal, execution identity, proof snapshot and IMMEDIATE claim transaction; never perform an unbound second read.
- [x] Add regressions for extra fields, competing claim, stale context and expired Lease; verify no forbidden transition occurs.
- [x] Modify the disposable Git/fake App Server tests to consume the returned context for objective and baseline, then prove the same original Attempt is quarantined on lost reply.
- [ ] Run targeted suites, independent security review, lint, typecheck, build, full unit and contract plus governance; record real counts and skips, then commit only authorized files.
