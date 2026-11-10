# Super Assistant repository instructions

## Current lifecycle state

- Integration recovery is active on `codex/task-720-audited`; TASK-720 has
  completed its local governance gate. TASK-721 is in progress with uncommitted
  security and notification changes. TASK-727 through TASK-736 have local
  implementation evidence but are not integrated acceptance or clean commits.
  Real Electron sandbox/preload verification is deferred until pre-release.
  H1 and H3 integrated acceptance remain unproven. Historical
  phase records below are not proof of current end-to-end acceptance.

- `PHASE-000` is the accepted document-first baseline; `TASK-000` is completed locally.
- `PHASE-001` is archived on `codex/phase-001-platform-foundation`; TASK-100
  through TASK-106 are accepted local evidence.
- `PHASE-002` is archived locally on
  `codex/phase-002-single-task-loop`. TASK-201 through TASK-207 and closeout
  TASK-204 are completed local evidence; TASK-202's user-approved real-smoke
  exception remains recorded in its phase archive.
- PHASE-003 through PHASE-006 have historical local archive records; their
  integrated behavior is subject to the current recovery acceptance gates.
- PHASE-007 is reopened. TASK-716 has uncommitted work in a separate worktree;
  preserve it and review any selectively transferred changes against its evidence.
- The initial GitHub publication is an S21 handoff after local acceptance, not an application phase.

## Sources of truth

Read these in order before changing the repository:

1. `docs/README.md` — document map and current status.
2. `docs/product.md` and `docs/requirements.md` — product truth.
3. `docs/architecture.md`, `docs/data-model.md`, and the relevant interface document — engineering truth.
4. The active phase plan and Task Pack — execution truth.
5. `docs/source/super-assistant-v3.md` — immutable source evidence, not current truth.

When sources disagree, the more specific active fact source wins. A conflict with an ADR requires a new superseding ADR. Never silently edit archived evidence.

## Delivery discipline

- Every implementation change must reference active `REQ-*` identifiers and one approved Task Pack.
- Respect the Task Pack allowlist. Do not expand scope through interpretation or broad file patterns.
- Side-effecting work requires an immutable approved Proposal or an explicitly approved repository Task Pack. Read-only queries do not.
- Application work uses an isolated `codex/phase-00x-*` branch and task worktree. `TASK-000` is the one approved bootstrap exception on a new `main`.
- Keep product, engineering, and execution facts synchronized before archiving a phase.
- A nonterminal phase cannot archive until the following phase's Task Packs are approved. `PHASE-007` archives only with the accepted H3 completion statement and maintenance-handoff packs.

## Validation

Run the local gate in the order documented by `docs/verification/quality-gate.md`. The principal commands are:

```powershell
python scripts/check_docs_links.py docs --json
python scripts/check_traceability.py --requirements docs/requirements.md --matrix docs/requirement-traceability-matrix.md --json
python scripts/check_schemas.py references/schemas --json
python scripts/verify_runtime_trace.py --mode plan --task-pack docs/delivery/tasks/TASK-000.md --schemas references/schemas.md --next-iteration 1 --json
python -m unittest discover -s tests -v
git diff --check
```

Remote CI is evidence only after it actually runs. Until then, label it `planned`.

## Safety invariants

- The platform database, never a model conversation, owns task state.
- Commands and events are at-least-once and therefore require idempotency.
- An attempt in `UNKNOWN` or `RECONCILING` cannot be redispatched before reconciliation.
- No secret is stored in repository files or SQLite. Windows Credential Manager holds credentials.
- Cancellation is incomplete until the process is terminated and its resource lease is released.
