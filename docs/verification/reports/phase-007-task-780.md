# TASK-780 — H1 Proposal candidate structural fields

Status: local verification; candidate CI pending. REQ-022 remains open: this
structural boundary is not a complete confirmable Proposal.

The domain parser requires a Project, Agent and Function and their pinned
versions, explicit capabilities and resources, one required WorkItem without
dependencies, action scope, reconfirmation triggers, risk and acceptance
evidence descriptions. It rejects missing fields, unknown keys or actions,
identity mismatches, contradictory action scope and read-only candidates.
Its output is detached from caller-owned input.

The new suite first failed because no module existed. An intentional passthrough
stub then failed all 22 tests on behavioral assertions; the parser passed all
22. The existing legacy ProposalVersion and stored digests remain unchanged.
No database, user Project, execution Adapter, confirmation interface, or live
Codex was invoked.

On Windows the production build, lint and typecheck passed. Full unit suite:
154 files, 530 passed and six PostgreSQL-dependent cases skipped. Contract:
eight files, 49 passed. Before the last documentation writeback, governance
scanned 322 Markdown files, validated Task Packs and traceability, five schemas,
returned anchored runtime Exit 0 and passed 34 Python tests. Governance must be
rerun after this report; skipped tests are not counted as passes.

The parser neither resolves identities nor validates resource containment,
capability availability or measurable outcomes. Budgets, deadline and validity
window are not represented. It creates no immutable persisted version, digest,
Grant or UI review and cannot authorize execution. These remain required before
REQ-022, H1/M1 or any related acceptance. Real Codex and Electron sandbox
verification remain deferred. Candidate CI has not yet run for this change.
