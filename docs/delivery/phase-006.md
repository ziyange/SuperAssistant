# PHASE-006: Domain and Adapter expansion

- State: Ready to open
- Horizon: H3
- Branch family: `codex/phase-006-*`
- Archive path: `docs/archive/phase-006/`

## Goal

Prove that the control plane supports operations, data, HR, and enterprise workflows through domain Agent packs, more adapters, generic onboarding, and safe visualized outputs without weakening H1/H2 guarantees.

## Requirements

Primary scope is the domain-Agent and adapter portion of `REQ-070–089`, with all relevant NFRs in `REQ-090–099`.

## Dependencies

Stable SAI conformance, monitoring pipeline, template model, evidence model, and approved PHASE-006 packs.

## Scope

- Curated domain Agent Templates and versioned Function schemas.
- Additional adapters selected by documented business value and conformance readiness.
- Generic adapter onboarding, health, capability, credential, and policy mapping.
- Domain Artifact viewers and safe visualization metadata.
- Domain-specific test fixtures, redaction, retention, and human-decision policies.

## Non-goals

No marketplace with unreviewed executable plugins, cross-tenant sharing, team RBAC, or legal claims that domain output is automatically authoritative.

## Interface impact

Extends catalog schemas and Artifact render contracts while retaining stable ExecutionPort semantics. Every adapter declares capability, authorization, error, retention, and conformance metadata. Untrusted output is sanitized and isolated.

## Risks and controls

- Capability overclaim: adapter conformance plus policy intersection.
- Domain data exposure: credential/data scopes, redaction, retention, and safe renderers.
- Inconsistent UX: shared Function, Proposal, Decision, and Artifact patterns.
- Schema drift: versioned inputs/outputs and compatibility fixtures.

## Test strategy

Per-adapter conformance, domain golden fixtures, malicious Artifact rendering, data redaction, compatibility matrices, onboarding Playwright flows, and representative end-to-end domain tasks.

## Entry conditions

H2 accepted; domain selection and data classification approved; each adapter threat model and conformance plan exists; packs approved.

## Exit conditions

- At least the approved domain workflows complete through the same authorization/evidence loop.
- New adapters pass the stable conformance kit.
- Domain data and credentials remain isolated and auditable.
- Visual outputs are safely rendered with provenance.
- PHASE-007 Task Packs are approved.

## Archive evidence

Archive adapter conformance, domain acceptance suites, data/security reviews, compatibility matrix, render security evidence, pack snapshots, commits, known issues, and team-governance readiness.
