# PHASE-004 TASK-407 deterministic DAG acceptance report

Status: completed locally after bounded remediation in TASK-408.

The thirty named scenarios cover DAG readiness and cycle rejection, exact and
hierarchical resource conflicts, fencing behavior, independent Tester/Inspector
evidence, and original-Task remediation. The first focused run produced the
required red evidence: `resource-21-parent-resource-blocks-descendant-write`
allowed a child resource after its parent was owned. TASK-408 repaired that
published scheduler contract without changing the task graph or quality
interfaces.

Final focused evidence: 32 tests passed (30 acceptance scenarios plus two
scheduler regression tests). Full local evidence is recorded by TASK-408;
remote CI remains planned.
