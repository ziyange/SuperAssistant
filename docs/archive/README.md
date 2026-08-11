# Phase archive and handoff

The archive preserves immutable evidence of what a phase intended, what it actually changed, how it was verified, and what is authorized next. It is history, not a second editable source of current product or engineering truth.

## Archive gate

Create `docs/archive/phase-NNN/` only after the phase acceptance owner records `PASS`. Archiving is prohibited until:

1. all required Task Packs have task-level `PASS`;
2. requirement, architecture/contract, command, limitation, roadmap, and ADR writeback is complete;
3. local/isolated evidence is complete and any expected remote evidence is either actually recorded or explicitly labeled `planned` with an approved rationale;
4. the final runtime-trace verification returns exit `0`;
5. known issues, blocked work, and rollback/recovery facts are preserved;
6. the following phase's Task Packs are validated, reviewed, `APPROVED`, and carry required human confirmation.

An exit `1`, `3`, `5`, or `6` blocks archive. Exit `2` or `4` blocks archive until its required dispatch is completed and a fresh verification returns exit `0`.

## Required directory contents

Each phase archive uses this shape; files with no applicable facts are omitted rather than created as empty placeholders.

```text
docs/archive/phase-NNN/
  summary.md
  phase-plan.md
  task-packs/
    TASK-NNN.md
  verification/
    gate-report.md
    test-results/
  decisions/
  changes/
  known-issues.md
  next-phase-handoff.md
```

Required content:

- `summary.md`: goal, final status, completed and incomplete requirements, delivered behavior, important changes, and acceptance identity/time;
- `phase-plan.md`: immutable snapshot of the accepted phase plan;
- `task-packs/`: exact approved and final-status snapshots for every pack executed in the phase, including superseded revisions when relevant;
- `verification/gate-report.md`: command order, environment/tool versions, exit codes, evidence labels, retained Artifact links, skipped-check rationales, and final runtime payload;
- `verification/test-results/`: durable test, lint, typecheck, build, migration, security, recovery, Playwright, contract, and smoke outputs required by the phase;
- `decisions/`: phase Decision/ADR references and any immutable approval evidence needed to interpret execution;
- `changes/`: Project Change, rollback, conflict-resolution, and writeback records; rollback appends a new linked record and never erases the original;
- `known-issues.md`: open risks, limitations, deferred failures, and owners or next review points;
- `next-phase-handoff.md`: next phase, approved pack IDs/revisions, entry prerequisites, remaining risks, and the exact next executable pack.

When Git exists, the summary records the accepted commit hashes and branch/worktree identity. External CI is recorded only with a run URL and conclusion. Large binary evidence stays in its governed Artifact store; the archive records a digest and durable locator rather than duplicating it.

## Writeback before snapshot

Writeback updates current facts before archive snapshots are taken:

1. update `REQ-*` status and acceptance/verification links;
2. patch the narrowest product or engineering source for behavior learned during implementation;
3. create or supersede an ADR for changed architecture, data, security, protocol, or lifecycle decisions;
4. update `AGENTS.md` and operations/test documents when commands or support rules changed;
5. update the traceability matrix and roadmap;
6. validate links, every Task Pack, traceability, schemas, runtime trace, and tests again;
7. record phase `PASS`, then create the immutable archive snapshot.

Prefer targeted patches. Execution facts in a Task Pack never silently replace product or engineering facts. Source evidence under `docs/source/` is never rewritten.

## Immutability and corrections

After handoff, archive files are read-only historical evidence. A correction is an append-only amendment that identifies the original file, reason, approver, timestamp, and replacement/current fact source. Do not rewrite an archive to make a failure, rollback, superseded pack, or previous decision disappear.

Current status lives in `docs/README.md`, current fact documents, the roadmap, and active delivery files. Those documents link to the archive; the archive does not become active authorization.

## Next-phase handoff

The handoff is valid only when it states:

- the accepted phase and evidence location;
- the next phase and exact `APPROVED` Task Pack revisions;
- `user_confirmed: true` or equivalent required approval evidence;
- entry conditions and environment prerequisites;
- unresolved risks and non-goals;
- branch/worktree expectation;
- the first permitted action and its verification gate.

If any next-phase pack is draft, changed after approval, missing validation, or lacks required confirmation, the completed phase may remain accepted but must not archive or authorize implementation of the next phase.
