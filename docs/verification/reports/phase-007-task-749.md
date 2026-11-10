# TASK-749 — read-only supervision evidence

Conclusion: REQUEST_CHANGES for historical scope violation; M1 remains NOT ACCEPTED. Scope is an uncommitted working patch based on
`db83fb9`, not a clean candidate commit or product acceptance. REQ-014,
REQ-015, REQ-018, REQ-028, REQ-029, REQ-049, REQ-090, REQ-091 and REQ-098
are addressed only at the fake-process observation seam.

## Behavior and test evidence

The supervisor retains one read-only client for its owned child, sanitizes
observations to ACTIVE / IDLE / INDETERMINATE, rejects pending observations
on shutdown, and terminates the child when an observation fails. IDLE does
not establish task completion or permit redispatch.

On Windows, 2026-11-09, Node 22.19.0, npm 10.7.0; working directory is
`E:\\Programs\\Super Assistant\\.worktrees\\TASK-720-audited`:

- Red: supervisor tests named “supervisor observes” and “invalid observation”:
  2 failed as expected because observe was absent.
- A second red test showed unsolicited malformed data returned stale cached health;
  the client readiness signal and supervisor check fixed it. Focused Vitest unit
  supervisor/client/discovery tests: 29 passed.
- `npm run build`, `npm run lint`, `npm run typecheck`: exit 0.
- Vitest unit: 150 files, 371 passed, 6 skipped; contract: 8 files,
  48 passed, 0 skipped. Skips are not acceptance evidence.
- Ordered governance: 261 Markdown files scanned with no link issues;
  all Task Packs valid; traceability and five schemas passed; anchored
  runtime trace exit 0; Python unit tests 29 passed; `git diff --check`
  exit 0. These checks preceded this report, whose runtime trace must
  be checked again.

## Remaining limitations

Scope audit: transaction task-749-client-010 changed
`packages/codex-adapter/src/app-server-client.ts` while it appeared only in
Context Pack, not Allowed Files. The standing user authorization permits
routine scope correction; task-749-boundary-013 adds the exact path to the
allowlist prospectively and does not erase the historical violation.
The earlier build-mode runtime Exit 0 did not prove whitelist compliance:
build mode checks a blacklist. Goal-mode validation before correction returned
Exit 2 and named this path. Current scope must be checked in goal mode as
well as by comparing Git changes to their respective task scopes.

The earlier idle malformed-message finding was fixed and covered by a
red-to-green regression. Readiness is only a local transport observation,
not proof of upstream execution or a terminal Attempt result.
No real Codex, Electron or sandbox
test ran. Live execution, durable reconciliation, external CI, current-SHA
evidence and the H1–H3 merge gates remain unverified.
