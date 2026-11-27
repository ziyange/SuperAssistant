# TASK-856: Bound authenticated Team HTTP request bodies

## Status
APPROVED
PHASE: PHASE-007
MAX_ITERATIONS: 3
user_confirmed: true
Authority: standing user authorization to fix independent security blockers while other diagnostics remain blocked. TASK-851, TASK-854 and TASK-855 remain unchanged and unaccepted.

## Requirement IDs
REQ-081, REQ-090, REQ-093, REQ-094, REQ-095, REQ-097

## Objective
Prevent the authenticated Team HTTP adapter from buffering unbounded POST bodies while preserving server-side authentication and authorization.

## Context Pack
- docs/delivery/phase-007-integration-recovery.md
- docs/security.md
- docs/architecture.md
- services/team/src/server.ts

## Must Read
- AGENTS.md
- docs/README.md
- docs/product.md
- docs/requirements.md
- docs/architecture.md
- docs/data-model.md
- docs/security.md
- docs/verification/quality-gate.md

## Allowed Files
- docs/delivery/tasks/TASK-856.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- docs/security.md
- services/team/src/server.ts
- services/team/tests/server.test.ts

## Forbidden Files
All other repository files, unrelated worktrees, real user Projects and credentials, system settings, production Team endpoint activation, real Codex, Electron sandbox-security verification, merge and release.

## Interfaces / Contracts
The authenticated HTTP server accepts at most 1048576 request body bytes. Larger declared or streamed POST bodies receive HTTP 413 without API invocation or persistence. Authentication remains server-owned and fail-closed. Valid bounded JSON preserves existing behavior.

## Data Constraints
Never log request bodies, secrets or identity material. Tests use loopback-only disposable servers and synthetic identities. Preserve inherited uncommitted security documentation and all other worktree changes.

## UI Constraints
No renderer or user-facing Team connection is enabled by this task.

## Implementation Requirements
Use test-first development; enforce the byte ceiling incrementally without relying solely on Content-Length. Stop accepting oversized input without retaining the remaining body, and avoid issuing API writes on malformed, aborted or oversized requests. Preserve existing authentication, response handling and server cleanup.

## Test Requirements
Test exact boundary and one-byte overflow, chunked overflow, oversized declared length, malformed and aborted requests, unauthenticated requests, safe cleanup, authenticated valid requests and no repository mutation after rejection. Run targeted server tests, applicable typecheck/lint/build and governance checks; record skipped or failed checks.

## Acceptance Criteria
No request exceeding the ceiling reaches the API or repository, bounded requests retain prior behavior, authentication is not bypassed, and responses do not expose request contents. Existing test timeouts must not be widened and required cases must not be skipped. The new real-time deadline test has its own 15-second runner budget because it exercises a ten-second server deadline; its separate measured close bound is 13 seconds.

## Done Definition
Record actual commands and results, obtain independent security review, and rerun affected gates before claiming completion. This task alone does not prove Team integration or permit merge.

## Risks
Unsafe stream termination can suppress the HTTP response or leak sockets; chunk boundaries and slow clients can bypass a header-only limit. Existing authenticated HTTP server also needs separate production deployment, TLS, identity and operational validation.

## Output Required
Bounded server implementation, deterministic negative and boundary tests, documented limits and actual verification evidence.

## Current evidence
- A real loopback regression initially showed a 1048577-byte POST returning 201 and invoking the repository. The adapter now checks the declared length and each streamed chunk, returning 413 without API/repository execution when the ceiling is exceeded.
- A malformed JSON regression showed the authorization port was still called; syntax errors now return 400 before the API. Separate tests preserve the existing handling of valid arrays, null, strings and numbers on unknown routes.
- Immediate destruction after a rejected streaming request reproduced an intermittent ECONNRESET instead of a complete 413. The rejection now drains without retaining data, with an additional 2 MiB drain threshold and a ten-second deadline, then pauses and sends FIN after the response is finished. An already delivered chunk may exceed the drain threshold. A hostile or broken peer can still fail to receive a response; this is not a hard real-time or general DoS guarantee.
- The latest targeted Windows suite passed 13/13, including exact boundary, one-byte overflow with and without chunking, aborted request, 401/413 incomplete input, deadline, five simultaneously streaming clients against one server, and five additional independent repeated streaming cases. The new real-time deadline test alone has a 15-second runner budget and requires closure within 13 seconds; no pre-existing timeout was widened.
- Full workspace typecheck and lint passed; Team service build passed; contract suite passed 50/50. Independent static review did not find a further confirmed limit bypass but identified unverified production authentication hangs, keep-alive and cross-platform socket behavior. Full unit, Python governance, desktop end-to-end and clean-candidate CI are not yet established for this change. System CPU was 96 percent when sampled; earlier full Python tests timed out at high load and have not been recertified.
- This task is not accepted and does not enable the Team endpoint or authorize merge. The untouched TASK-716 worktree remains separate; its older queue implementation must not overwrite later idempotency and reconciliation fixes.
