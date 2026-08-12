# Deterministic fixture policy

Fixtures are versioned, local, and deterministic. They may not include a real credential, user repository, network endpoint, or mutable clock. Each fixture names its owner Task Pack, source version, stable identifiers, expected inputs/outputs, and cleanup rule.

TASK-101 creates no committed executable test fixture because its exact allowlist contains no test-source file. Its required negative discovery proof uses a temporary Vitest file outside the repository, deletes it after execution, and records the result in the Task report. Later Task Packs must add each fixture and test file explicitly to their own allowlists.
