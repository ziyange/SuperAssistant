# TASK-785 verification — Project Git baseline

Patch baseline: `a8e677e`. Bounded verification for
[TASK-785](../../delivery/tasks/TASK-785.md). Scope: internal draft creation
and its Git-reader boundary; not H1/M1 or merge acceptance.

The disposable SQLite/Git regression was red before implementation: the
old store accepted a full commit ID unrelated to the registered repository's
HEAD. The final run covered full/abbreviated/symbolic IDs, valid and advanced
HEAD, a nested directory, an unborn repository, a missing Project path,
and inherited `GIT_DIR`/`GIT_WORK_TREE` pointing away from the Project.
It verified no rejected drafts are persisted, historical drafts remain
readable, and no Grant or Task is created.

With Node 22.19.0, npm 10.7.0, Git 2.55.0.windows.3 and Python 3.9.12
in the candidate worktree, the targeted Vitest run passed all 3 tests
across two files. Production workspace builds, lint and workspace typecheck
passed. Full Vitest: 540 unit tests passed across 156 files,
six PostgreSQL-dependent skips; 49 contract tests passed across eight files.

The ordered governance preflight scanned 333 documents, validated 132 Task
Packs, traceability and five schemas, returned Plan-mode runtime Exit 0,
passed 34 Python tests and checked exact file scope. The same gate is rerun
after this report. Candidate CI must be observed on the new commit.

[OpenAI's pinned Codex 0.121.0 implementation](https://github.com/openai/codex/blob/rust-v0.121.0/codex-rs/app-server/src/models.rs)
uses an online refresh strategy when the cache is empty; no model query was
added to the default check. Model availability alone does not prove a
versioned executable Function. Trusted Function discovery, immutable
review, current-policy revalidation and execution/recovery remain open.
No real Codex, Electron sandbox or local PostgreSQL integration was run.
No user Project, remote main or preserved worktree was modified.

Candidate `6a43fcb` failed the
[Windows CI draft regression](https://github.com/ziyange/SuperAssistant/actions/runs/44448175778):
the valid repository was rejected with `DRAFT_BASELINE_UNVERIFIED`.
On local Windows, a disposable fixture forced the stored directory and Git's
reported root to differ only in spelling case and reproduced the same
failure before the fix. Comparing the two OS-resolved native canonical
paths fixes that case without comparing case-folded arbitrary paths or
relaxing the exact HEAD, scope, or containment checks. The focused
regression then passed all 3 cases.

Post-fix verification on the same toolchain: production build, lint and typecheck passed;
540 unit tests passed, six PostgreSQL-dependent skips; 49 contract tests passed.
Final governance and CI are checked against the follow-up candidate.
