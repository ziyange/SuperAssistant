# TASK-000: Establish the document-first lifecycle baseline

## Status

IN_PROGRESS

PHASE: PHASE-000

MAX_ITERATIONS: 3

user_confirmed: true

## Requirement IDs

REQ-090, REQ-091, REQ-092, REQ-093, REQ-094, REQ-095, REQ-096, REQ-097, REQ-098, REQ-099

## Objective

Convert the approved V3.0 proposal into a complete product, engineering, delivery, verification, and archive fact system; initialize local Git evidence; and stop before application implementation.

## Context Pack

- `docs/source/super-assistant-v3.md`
- `docs/superpowers/specs/2026-08-09-super-assistant-lifecycle-design.md`
- `docs/superpowers/plans/2026-08-09-super-assistant-doc-first-initialization.md`

## Must Read

- `AGENTS.md`
- `docs/README.md`
- `references/methodology.md`
- `references/review-gates.md`
- `references/pain-points.md`
- `references/schemas.md`

## Allowed Files

- .git/HEAD
- .git/config
- .gitignore
- AGENTS.md
- .github/workflows/docs-gates.yml
- docs/README.md
- docs/source/README.md
- docs/source/super-assistant-v3.md
- docs/product.md
- docs/requirements.md
- docs/requirement-traceability-matrix.md
- docs/architecture.md
- docs/data-model.md
- docs/security.md
- docs/api/sai.md
- docs/adapters/codex.md
- docs/orchestration.md
- docs/ux.md
- docs/operations.md
- docs/decisions/README.md
- docs/decisions/ADR-001-local-first.md
- docs/decisions/ADR-002-codex-app-server-stdio.md
- docs/decisions/ADR-003-authoritative-state-and-delivery.md
- docs/decisions/ADR-004-task-worktrees.md
- docs/decisions/ADR-005-rolling-task-packs.md
- docs/superpowers/specs/2026-08-09-super-assistant-lifecycle-design.md
- docs/superpowers/plans/2026-08-09-super-assistant-doc-first-initialization.md
- docs/delivery/README.md
- docs/delivery/roadmap.md
- docs/delivery/phase-001.md
- docs/delivery/phase-002.md
- docs/delivery/phase-003.md
- docs/delivery/phase-004.md
- docs/delivery/phase-005.md
- docs/delivery/phase-006.md
- docs/delivery/phase-007.md
- docs/delivery/pain-point-assessment.md
- docs/delivery/locks.yml
- docs/delivery/tasks/README.md
- docs/delivery/tasks/TASK-000.md
- docs/delivery/tasks/TASK-101.md
- docs/delivery/tasks/TASK-102.md
- docs/delivery/tasks/TASK-103.md
- docs/delivery/tasks/TASK-104.md
- docs/delivery/tasks/TASK-105.md
- docs/delivery/tasks/TASK-201.md
- docs/delivery/tasks/TASK-202.md
- docs/delivery/tasks/TASK-203.md
- docs/delivery/permission-audit.log
- docs/delivery/execution-trace.json
- docs/delivery/expansions.json
- docs/verification/test-strategy.md
- docs/verification/quality-gate.md
- docs/verification/scenarios.md
- docs/verification/reports/initial-docs-baseline.md
- docs/archive/README.md
- scripts/scaffold_docs.py
- scripts/check_docs_links.py
- scripts/check_task_pack.py
- scripts/check_permission_log.py
- scripts/lock_manager.py
- scripts/verify_runtime_trace.py
- scripts/check_traceability.py
- scripts/check_schemas.py
- references/agent-git-ci.md
- references/capabilities-matrix.md
- references/examples.md
- references/methodology.md
- references/pain-points.md
- references/prompts.md
- references/review-gates.md
- references/schemas.md
- references/templates.md
- references/schemas/AuditLogSchema.json
- references/schemas/ExecutionTraceSchema.json
- references/schemas/ExpansionSchema.json
- references/schemas/PainPointCardSchema.json
- references/schemas/TaskPackSchema.json
- tests/test_check_schemas.py
- tests/test_check_task_pack_policy.py
- tests/test_check_traceability.py

## Forbidden Files

- Any file not explicitly listed in Allowed Files.
- Any Electron, React, TypeScript, JavaScript, Node application, SQL migration, package manifest, or dependency lockfile.
- Any credential, secret, or environment file.
- Any remote other than `https://github.com/ziyange/SuperAssistant.git`, and any pull, fetch, merge, force-push, history rewrite, tag, release, or branch deletion.

## Interfaces / Contracts

Document the stable SAI ExecutionPort, command/event envelopes, Codex App Server mapping, authoritative-state and delivery semantics, task-worktree policy, and rolling Task Pack policy. Governance scripts retain their documented CLI contracts.

## Data Constraints

The source proposal remains byte-identical and has recorded SHA256. Requirements use permanent REQ identifiers. Current facts and archive evidence are distinct. Audit and trace entries conform to standalone schemas and preserve their hash chain.

Git credentials remain outside repository content. Direct manual editing of Git object, ref, index, or log files is prohibited; internal metadata written by the approved `git add`, `git commit`, `git remote add`, `git branch -M`, and `git push -u` commands is command-managed evidence rather than general file authorization.

## UI Constraints

Only document UX facts. Do not create UI assets or application components. UX facts must keep provider Thread/Turn concepts out of product surfaces and record Connection display precedence over Availability.

## Implementation Requirements

- Create all facts and links named by the approved plan.
- Define H1–H3 and all seven phases before any application code.
- Create approved Phase 1 packs and full draft Phase 2 packs.
- Vendor governance scripts and schemas without external network access.
- Initialize `main` and make exactly three reviewable baseline commits.
- After the complete local gate and the third commit, configure only `origin=https://github.com/ziyange/SuperAssistant.git`, keep the branch name `main`, and publish with upstream tracking.
- Do not pull, fetch, merge, force-push, rewrite history, create a release, or publish another branch or remote.

## Test Requirements

- `python scripts/check_docs_links.py docs --json`
- Run `python scripts/check_task_pack.py` with `--json` for TASK-000, TASK-101 through TASK-105, and TASK-201 through TASK-203.
- `python scripts/check_traceability.py --requirements docs/requirements.md --matrix docs/requirement-traceability-matrix.md --json`
- `python scripts/check_schemas.py references/schemas --json`
- `python scripts/verify_runtime_trace.py --mode plan --task-pack docs/delivery/tasks/TASK-000.md --schemas references/schemas.md --next-iteration 1 --json`
- `python -m unittest discover -s tests -v`
- `git diff --check`
- `git status --short`

## Acceptance Criteria

- The imported source hash equals `38BA6E111E321E562B4AD2F42064B91D48ED60F0463DAFDE28E26899E9A7202B`.
- Every active REQ has one complete trace row with phase, acceptance evidence, and named verification scenario.
- Every Task Pack passes the structural and exact-boundary validator.
- All five schemas are valid and runtime trace verification exits `0` in Plan mode.
- The verification report contains actual local command results and labels remote CI as planned.
- Local `main` contains exactly three logical baseline commits and a clean worktree.
- `origin` equals `https://github.com/ziyange/SuperAssistant.git`, local `main` tracks `origin/main`, and the remote points to the same published commit.

## Done Definition

All acceptance criteria pass, active facts agree, phase handoff rules are explicit, application code is absent, and the initial baseline report plus Git history provide reproducible evidence.

## Risks

`SECURITY_PERMISSION` is activated at `0.600` and confirmed by the user. The baseline must deny scope expansion, exclude secrets, keep Git credentials outside repository content, and use exact file permissions. `CONCURRENCY_RACE` at `0.526` is ignored only by Top-1 selection and remains represented by worktree and lease gates. False evidence is controlled by recording actual local output and distinguishing planned CI. The first push is fast-forward publication only; authentication failure or a non-empty conflicting remote stops the task without force-push.

## Output Required

Return the three commit hashes, created fact-source and Task Pack paths, requirement and scenario counts, exact validation results, remote configuration state, and any known issue that prevents PHASE-001 from opening.
