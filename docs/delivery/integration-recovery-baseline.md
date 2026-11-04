# Integration recovery baseline

Recorded 2026-11-04. Integration candidate `codex/integration-readiness` starts at
`4984e02cdf13bc58129ffdea382dd22eedadd0bf`; local `main` and its last known
`origin/main` tracking ref are `5d107037583f870ec38c36162313d08f35948e84`.
Remote freshness has not been checked. M1 and M2 remain unaccepted.

The separate TASK-716 worktree remains at `4984e02` with these 30 uncommitted
paths. They are preserved in place and are not part of this integration
candidate until independently reviewed and deliberately transferred.

## Modified paths (16)

- `apps/desktop/src/main/ipc-router.ts`
- `apps/desktop/src/main/ipc-schemas.ts`
- `apps/desktop/src/main/main.ts`
- `apps/desktop/src/preload/index.ts`
- `apps/desktop/src/preload/team-api.ts`
- `apps/desktop/src/renderer/App.tsx`
- `apps/desktop/src/shared/ipc-contract.ts`
- `apps/desktop/tests/main/ipc-router.test.ts`
- `docs/delivery/tasks/TASK-716.md`
- `docs/operations.md`
- `docs/security.md`
- `docs/ux.md`
- `services/team/src/postgres/schema.ts`
- `services/team/src/postgres/team-repository.ts`
- `services/team/src/team-api.ts`
- `services/team/tests/postgres-team-repository.test.ts`

## Untracked paths (14)

- `apps/desktop/src/main/team-notification-client.ts`
- `apps/desktop/src/main/team-notification-ipc.ts`
- `apps/desktop/src/renderer/team-notification-settings.tsx`
- `apps/desktop/tests/e2e/team-notification.spec.ts`
- `apps/desktop/tests/main/team-notification-ipc.test.ts`
- `apps/desktop/tests/renderer/team-notification-settings.test.tsx`
- `docs/verification/reports/phase-007-task-716.md`
- `services/team/src/notification-delivery-service.ts`
- `services/team/src/notification-outbox.ts`
- `services/team/src/notification-preference-service.ts`
- `services/team/tests/notification-api.contract.test.ts`
- `services/team/tests/notification-delivery-service.test.ts`
- `services/team/tests/notification-outbox.test.ts`
- `services/team/tests/notification-preference-service.test.ts`

Original work remains an unaccepted TASK-716 implementation, not a release or
proof of an integrated Team notification channel. Its prior report contains
local test results with the limitations documented there.

## SHA-256 inventory

```text
1bdae91d61838832d94224e1e921744d4c534a576aaaf38cc8f63d861f46072f  apps/desktop/src/main/ipc-router.ts
d02ef54fc8e5e4f59337be71cdfdee3825ae3df64d9d36915f22c4232b59a6df  apps/desktop/src/main/ipc-schemas.ts
6cafd5dc10ca0d5a3be019909949ca2f84d23a19666ccab100867ba39176caf0  apps/desktop/src/main/main.ts
1693094135df8adfe645f05943d993e7374211c04ccbe081e7432a3448cc9cef  apps/desktop/src/preload/index.ts
2686ba311665271afbe11fdd00f42cb8323461c92ecf39882cbfdab42c5b17fc  apps/desktop/src/preload/team-api.ts
1b8385e21bf7f3975b6ebe3539cbc50ebd5590651b6c5ddbf317bdc3b1309985  apps/desktop/src/renderer/App.tsx
a3d3fab7013e493a9e9da70a6ff7bf95f304aec71a458609a54fb27b33bb5e9a  apps/desktop/src/shared/ipc-contract.ts
4f0c915b694d7b41fe15807dfbb6aa2a4e4f8e71781e0729c6ebc41cf135cd68  apps/desktop/tests/main/ipc-router.test.ts
07e056a6a183c5179ed9f449baca34be6d966331efd8efc207878fd019823bb5  docs/delivery/tasks/TASK-716.md
a4c1bcd09d9c8d81320ad35ffdd442c1aff9f795cd7f04b5fd70c60574e7fac9  docs/operations.md
0f5202bbd3df8892e88a2c48c2edf66c64ab1f544bf18f25243a3246ee3cccea  docs/security.md
8b018c9cb6bc2387b956f89f88e13c757328b81d50b66ca7b64e561315d6b34e  docs/ux.md
d0889752948db1240b0b5e75954e4b8093633ebdffb3d3ff1c4423fae23000a4  services/team/src/postgres/schema.ts
0c304333849c4af2fa0cd053d69a6cdfa27e837aed8aaecfd9c1404ae3cb2ff6  services/team/src/postgres/team-repository.ts
1930f76f28863764ed67802b7c947b28f756d51e50637f223f83f0c7ea9bc781  services/team/src/team-api.ts
97c4f308835c78b3197659489f707f7de7868f0f3f9e94911263cb450ccdd372  services/team/tests/postgres-team-repository.test.ts
b28d7b3939d01b73546abcbc491313fea4c0f4228bc69946bb38e63c5a7af53e  apps/desktop/src/main/team-notification-client.ts
873b05e278a913ee5fbdd8ed869490b75ed3a949be6796b6f7bc91f4a6fdd101  apps/desktop/src/main/team-notification-ipc.ts
d15bbe0b57d1191f4365587d3643654d30927c08a8347d9020ed397d65aa9fd4  apps/desktop/src/renderer/team-notification-settings.tsx
fd0096e8aecb5b5a1b5ef2b63be6b4ec601fe285069521b91b46962d312e908a  apps/desktop/tests/e2e/team-notification.spec.ts
f4b16be453a7961a10d024030a94f0868be1396804424ecdfe9f987a392b3ec5  apps/desktop/tests/main/team-notification-ipc.test.ts
5ff2ff4dc28c416a1492a6a1ad241cdfe84d6bfcce34b4439c597c881cec77c8  apps/desktop/tests/renderer/team-notification-settings.test.tsx
d0cd56d3afcc97cf29bdb828b10eefcc56c4bc0ece4076a3434b4c8a7b6dfaa8  docs/verification/reports/phase-007-task-716.md
ad780a95cb91ef73d73be9d2a20cdb2beed4916201dfb5a2fc9016abe50851e9  services/team/src/notification-delivery-service.ts
f311f453ffbf8faeccb9564f2a620dcf86fd9d82f74a939365e2049cf23f3b7f  services/team/src/notification-outbox.ts
ee0125ecf6c779a0501dbedb7fd74d570a837fc72cca22485f0e3e5ce298652f  services/team/src/notification-preference-service.ts
01aa9cfdfc7af97901033e03807e819e4972dded5dbe42ad39f57e59fe040a23  services/team/tests/notification-api.contract.test.ts
1f681fc28ac8cb030ced464460b3f40a676251b0ad2dab2b43276894749523a3  services/team/tests/notification-delivery-service.test.ts
61650e9400dd0e0eeee790f2d0e604630d613e733f0c550036269236c7bd28cb  services/team/tests/notification-outbox.test.ts
0d22cf8f5373fee0449876a36433ca427c8e03ae7b73c0f9579b938a1f7267c6  services/team/tests/notification-preference-service.test.ts
```

## TASK-720 recovery snapshot

Point-in-time SHA-256 values from 2026-11-04 10:57 +08:00, before writing this
section. The baseline document and audit/trace files are excluded to avoid
self-reference. Later edits can change these hashes. This records the state
reviewed at recovery time and does not recreate missing prior intent records.

```text
8d754a5a4161fe81da286e5e2c5059cf0970bd5420968010e73af31b62d18125  AGENTS.md
b0f90db9ad018b66545106c17bcf728cd1bc9a98afdb57cd084e883c16d5d7d0  docs/README.md
d0b507ff44a01f5a2f2a6a0ebf3490b0b13bd3281f99645eb3eba02087a7231b  docs/delivery/tasks/README.md
5bbaf005c007cf59173aaf176b8d0652fa6bd22ff8c6f98ea7f516cedcc8fb42  scripts/check_docs_links.py
a4729d3946a6b8dc2b8cee9473958f0b7b8baac06ac779cbc83e4dcfa44ee046  scripts/check_traceability.py
734e7646d7e75fc4b2ae11743d8088c08ee4875bbeeadf18144639888e4524a3  scripts/verify_runtime_trace.py
06de78565fbdb8663f92bd79865e32a2692f8a47e9e5bc86d9e8e7c06548a8bf  tests/test_check_traceability.py
c877781c1c5227957f396a094d4d1a365d6e0912b6856f51ad3f75667b950749  docs/delivery/tasks/TASK-720.md
a65756e04e9830af1052d880ea07b3db440642dc496c87a7d90a7757c7ecceeb  docs/verification/reports/integration-architecture.md
7738498b421b647663c354bbe2b089645232d8073b4996b3f4fdce0c1227fb60  docs/verification/reports/phase-007-task-720.md
9dc1f260b8585a64e87fdd0e75227bac475ac7186a86618e8946edf5c0b22462  tests/test_check_docs_links.py
bf96e8d0e4bd5ee05dbaf57cdf3b24612fe50b4664c6d4c2d4b4b3545596e516  tests/test_verify_runtime_trace.py
```
