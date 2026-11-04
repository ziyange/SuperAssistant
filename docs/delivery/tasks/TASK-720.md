# TASK-720: Preserve integration baseline and repair governance gates
## Status
COMPLETED
PHASE: PHASE-007
MAX_ITERATIONS: 6
user_confirmed: true
## Requirement IDs
REQ-090, REQ-093, REQ-095, REQ-096, REQ-099
## Objective
Preserve TASK-716 work, establish the integration candidate and repair false-positive governance validation before further acceptance.
## Context Pack
- docs/delivery/phase-007-integration-recovery.md
- docs/verification/quality-gate.md
## Must Read
- AGENTS.md
- docs/README.md
- docs/requirements.md
- docs/verification/test-strategy.md
## Implementation Requirements
Inventory all existing TASK-716 changes without altering them. Record baseline identities and conflicts. Repair Markdown discovery under hidden ancestor directories, fail on zero files, validate malformed or missing runtime evidence and missing JSON Schema dependencies. Preserve user files and archived evidence.
## Allowed Files
- docs/delivery/tasks/TASK-720.md
- docs/delivery/tasks/README.md
- docs/verification/reports/phase-007-task-720.md
- docs/verification/reports/integration-architecture.md
- docs/delivery/integration-recovery-baseline.md
- docs/delivery/execution-trace.json
- docs/delivery/permission-audit.log
- docs/README.md
- AGENTS.md
- scripts/check_docs_links.py
- scripts/check_traceability.py
- scripts/verify_runtime_trace.py
- tests/test_check_docs_links.py
- tests/test_check_traceability.py
- tests/test_verify_runtime_trace.py
## Forbidden Files
Prior archive evidence, user-owned untracked files, TASK-716 worktree files, and application implementation are outside this pack.
## Interfaces / Contracts
Governance commands retain JSON output and exit semantics. A zero-file directory scan fails; malformed and missing required runtime inputs fail closed. Task acceptance invokes runtime verification with `--require-task-evidence`, requiring a matched task-named write intent and result; this presence check does not replace the exact Git-path review or prove coverage of every modified file.
## Data Constraints
Inventory filenames and hashes only; do not copy secrets or alter existing audit entries. Append new intent and result entries only for actions actually performed after the intent is recorded, under the audit lock. Earlier unrecorded edits remain explicitly disclosed.
## UI Constraints
Not applicable: this task changes governance and documentation, not graphical UI.
## Test Requirements
Run Python unit tests covering hidden ancestor paths, broken links, zero scans, nonexistent traceability references, missing and malformed runtime evidence, missing schema validator, and all existing governance tests. Run documented validators in order and record actual counts and exit codes.
## Acceptance Criteria
G0/G1 require preserved baseline, reviewed inventory, complete nonzero Markdown discovery, effective negative cases, valid schemas, meaningful trace inputs, exact scope review, and current evidence. Missing downstream evidence remains PLANNED.
## Done Definition
All G0/G1 checks pass, facts are synchronized and the verification report records actual commands, results and remaining limitations.
## Risks
Existing broken links and malformed trace inputs may expose additional defects; stop and report instead of claiming PASS.
## Output Required
docs/verification/reports/phase-007-task-720.md and docs/delivery/integration-recovery-baseline.md.
