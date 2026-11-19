# TASK-786 verification — approved worktree baseline

Baseline: `1626c6c`. Scope: [TASK-786](../../delivery/tasks/TASK-786.md)
only; this is not H1/M1 acceptance.

The initial Git fixture run produced three expected failures: ambient Git
overrides reached the helper, a missing baseline was silently accepted,
and a checkout that advanced source HEAD still returned ACTIVE. All five
focused worktree tests now pass. They verify the exact approved checkout,
reject missing, abbreviated and stale IDs before write, retain a dirty area,
remove an owned clean failed area without force, and refuse to continue
after a deterministic HEAD change during setup.

Production build, lint and workspace typecheck passed with Node 22.19.0
and npm 10.7.0. An initial lint failure on a TypeScript-only namespace was
resolved with an inferred return type; the complete gate was rerun.
Full Vitest: 542 unit tests passed, six PostgreSQL-dependent skips;
49 contract tests passed.

The preflight checked 335 Markdown files, 133 packs, traceability, five
Schemas, Plan runtime Exit 0, and 34 Python tests. Repeat after this
report. A documentation patch context mismatch was reconciled under the
original pending intents before any code change, then the full preflight
passed. Remote CI is additional evidence for the candidate SHA.

No user Project was opened for write. No real Codex or Electron sandbox
validation was performed. The internal port requires the approved commit;
there is still no production dispatch caller that loads an immutable
approval and current Lease and provides it. There is no claim of atomic
locking across Git/SQLite or of safe use of unverified checkout hooks.
