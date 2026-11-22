# ADR-008: Protected task content

Status: Accepted design; foundation under implementation. 2026-11-22.

## Context

User goals and complete proposals may contain sensitive business information. Existing Proposal columns are plaintext and are not safe for newly connected user input. The user approved encrypted task content in SQLite with keys in Windows Credential Manager; this does not authorize storing actual credentials in SQLite, even encrypted.

## Decision

Use independently generated 256-bit per-record keys, AES-256-GCM with random 96-bit nonces and 128-bit tags. Versioned associated data binds workspace, project, record ID, content kind, key reference and creation time. SQLite contains only ciphertext and bounded nonsecret metadata. Production key operations require a main-process Windows Credential Manager broker; no key, credential, or plaintext is logged or passed in command arguments. Authentication and authorization precede plaintext release. No missing key may be silently replaced.

The first implementation is an isolated foundation with a test-only key provider; it does not enable the existing plaintext Proposal flow. Existing data, WALs, journals and backups are not silently migrated or deleted. Actual credentials must use separate credential handles; generic secret detection cannot prove arbitrary user text is credential-free. A user text ingestion policy and enforceable credential handling remain required before connecting persistence.

## Consequences and follow-up

SQLite and Windows Credential Manager do not share a transaction. A production broker must handle concurrent key creation, orphan keys, backup/restore, missing keys and crash recovery without overwriting existing secrets. Encryption does not protect a compromised Windows account or detect complete database rollback. Existing digest and Grant verification are versioned compatibility concerns and cannot be changed silently. H1/H3 delivery and production encrypted persistence remain unverified until integrated end to end.

This additive decision does not supersede ADR-003 authority or the credential isolation requirements. References: [Node crypto](https://nodejs.org/download/release/v22.23.3/docs/api/crypto.html), [Windows CredWrite](https://learn.microsoft.com/en-us/windows/win32/api/wincred/nf-wincred-credwritew).
