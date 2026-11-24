# TASK-844: Compose protected cancellation and owner stop in the fixture

## Status
COMPLETED
PHASE: PHASE-007
MAX_ITERATIONS: 6
user_confirmed: true
Authority: user authorized continuing fake App Server integration and running cancellation until merge gates are met; real Codex and Electron sandbox security verification remain deferred.

## Requirement IDs
REQ-027, REQ-028, REQ-031, REQ-033, REQ-038, REQ-049, REQ-090, REQ-093, REQ-095, REQ-097

## Objective
Replace the manually sequenced protected cancellation test with one bounded same-session command that confirms cancellation, interrupts the original fake Attempt, requests owner stop and preserves UNKNOWN with its Lease held whenever termination cannot be trusted.

## Context Pack
- docs/delivery/tasks/TASK-823.md
- docs/delivery/tasks/TASK-843.md
- docs/api/sai.md
- docs/adapters/codex.md
- docs/security.md
- docs/orchestration.md

## Must Read
- AGENTS.md
- docs/README.md
- docs/product.md
- docs/requirements.md
- docs/architecture.md
- docs/verification/quality-gate.md

## Allowed Files
- docs/delivery/tasks/TASK-844.md
- docs/delivery/tasks/TASK-843.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- docs/security.md
- docs/orchestration.md
- apps/desktop/src/main/fixture-protected-dispatch.ts
- apps/desktop/tests/main/protected-approval-execution.test.ts

## Forbidden Files
All other repository paths, production route or migration 033 activation, actual user databases and credentials, real Codex, Electron sandbox security verification, merge and release.

## Interfaces / Contracts
The fixture dispatcher may cancel only its own active scope and client after the existing main-owned cancellation decision. Duplicate in-flight calls coalesce; unrelated, dismissed or unavailable requests never signal a process. Interrupt and owner stop are bounded. Unverified termination or lost response cannot mark CANCELLED, release a Lease, dispatch again or create a new Attempt. A fixture callback is not production ownership evidence.

## Data Constraints
Use disposable Git Projects, SQLite, fake App Server and synthetic credentials only. Preserve original Attempt and evidence. Never terminate unrelated processes or write secrets to logs.

## UI Constraints
No production IPC or renderer route is enabled. The fixture result is not user-facing completion or production termination proof.

## Implementation Requirements
First write failing tests for automatic same-session cancellation through the real Windows Job and fake App Server, concurrent requests, dismissed consent, wrong scope, failed interrupt and hanging or unverified stop. Reuse the existing authority and quarantine path. Bound waiting without weakening original process-termination gates.

## Test Requirements
Run targeted fixture and authority tests, real Windows owner/fake service tests, typecheck, lint, build, full CI-aligned unit and contract suites, Electron functional and browser E2E, governance and security review. Real Codex and sandbox security tests remain deferred.

## Acceptance Criteria
A single fixture cancellation command prompts once, sends no unauthorized interrupt, never affects another scope, stops the exact owned fixture when available and leaves the same Attempt UNKNOWN with its Lease ACTIVE unless separately proven recovery takes over. Duplicate and failure cases cannot create or dispatch another Attempt.

## Done Definition
Record actual local and CI evidence, skipped checks and unresolved production trust, terminal reconciliation and IPC gaps. Do not claim H1 or merge acceptance.

## Risks
The owner response and fixture transport remain untrusted. A STOP acknowledgement is not proof of whole-tree exit or permission to release a Lease.

## Output Required
Bounded fixture cancellation orchestration, end-to-end and negative tests, synchronized facts and verification evidence.

## Work in progress evidence
The real Windows Job and fake App Server cancellation test first failed because
the single cancellation command was absent, then passed after implementation.
The focused 37-test file passed; a separate nonresponsive-stop test passed.
Build, typecheck and lint passed after correcting initial typecheck and lint
errors. The complete unit run had 1161 passed and 9 explicitly allowlisted
skips; contract tests had 50 passed, zero skipped. Real Electron functional
tests passed 2, browser E2E passed 9, and the shared Electron database hash was
unchanged. Independent read-only security review found no confirmed Critical
or Important issue; it noted that timed-out operations may complete later and
suggested further consent/interrupt race coverage. This fixture is not the
production desktop cancellation path.

An audit-history check overlapped the security-document transaction and saw
its temporary PENDING intent (Exit 4). That transaction was subsequently
committed with its result; the history check must be rerun without concurrent
writes before completion. Real Codex and Electron sandbox security remain
deferred; production owner provenance, terminal reconciliation and IPC remain
unproven. CI for this uncommitted change has not run.

Candidate commit `e67309b2a07c1c849476f1bf457ab9fbe27b4b89` passed GitHub
documentation run 45329365535 and application run 45329365538, including its
Windows and PostgreSQL 16 jobs. These results do not establish production
process ownership, protected IPC, or integrated H1 acceptance.
