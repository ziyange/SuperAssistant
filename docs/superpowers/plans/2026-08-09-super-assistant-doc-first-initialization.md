# Super Assistant document-first initialization plan

- Status: Local baseline complete; publication outcome is external S21 handoff evidence
- Date: 2026-08-09
- Execution mode: Strict + Plan
- Completed Task Pack: `TASK-000`

## Outcome

Transform the V3.0 proposal into a self-contained, versioned repository of product facts, engineering facts, delivery facts, verification gates, and archive rules. This task deliberately stops before application implementation.

## Work packages

1. Preserve the original proposal byte-for-byte with provenance and SHA256; create repository and documentation indexes.
2. Write product positioning, scope, success criteria, atomic requirements, conflict resolutions, and complete traceability.
3. Lock the architecture, data model, security model, SAI, Codex adapter, orchestration, UX, operations, and five core ADRs.
4. Define the H1–H3 roadmap and seven delivery phase plans with entry, exit, risks, tests, and archive destinations.
5. Create executable `TASK-000`, approved Phase 1 packs `TASK-101`–`TASK-105`, and complete draft Phase 2 packs `TASK-201`–`TASK-203`.
6. Vendor the document-first validators and standalone schemas; add traceability/schema checks, tests, and a GitHub Actions workflow using the local gate.
7. Produce a valid Plan-mode execution trace, initial verification report, and archive handoff process.
8. Review the complete baseline, make three commits on `main`, then publish the verified baseline to the user-approved GitHub `origin`.

## Constraints

- Allowed changes are documentation, governance scripts, schema files, CI configuration, and Git metadata.
- No Electron, React, TypeScript, Node application, database migration, adapter, UI, dependency install, pull, merge, force-push, history rewrite, or remote other than the approved `origin` is allowed.
- Remote configuration and the first `main` push are permitted only after the full local gate passes and all three baseline commits exist. The approved URL is `https://github.com/ziyange/SuperAssistant.git`.
- Source evidence remains unchanged after import.
- Task Packs use explicit file paths and never broad recursive allowlists.
- Remote CI is recorded as planned until it runs.

## Validation sequence

1. Validate documentation links and anchors.
2. Validate every Task Pack and its exact file boundaries.
3. Validate every active REQ has phase, acceptance, and verification mapping.
4. Validate all five standalone JSON Schemas.
5. Validate the Plan-mode permission and execution trace with exit `0`.
6. Run governance unit tests and `git diff --check`.
7. Record actual command output in the baseline report and confirm only planned paths changed.

## Commit boundaries

1. `docs: establish Super Assistant source and facts`
2. `docs: define delivery roadmap and task packs`
3. `chore: add governance gates and verification evidence`

## Completion gate

Local execution is complete when the full local quality gate passes, all created files are represented in the current trace/verification evidence, exactly three baseline commits exist on `main`, and the worktree is clean. The S21 publication handoff completes the user-facing plan only after live Git evidence confirms that `origin` equals the approved URL and local `main` tracks `origin/main` at the same commit; that post-commit result is reported in the final handoff rather than asserted recursively inside its own commit.
