import { fileURLToPath, URL } from 'node:url';
import { defineWorkspace } from 'vitest/config';

const sourceAliases = {
  '@super-assistant/domain': fileURLToPath(new URL('./packages/domain/src/index.ts', import.meta.url)),
  '@super-assistant/persistence': fileURLToPath(new URL('./packages/persistence/src/index.ts', import.meta.url))
};

export default defineWorkspace([
  {
    resolve: { alias: sourceAliases },
    test: {
      name: 'unit',
      include: ['packages/*/tests/**/*.test.ts', 'apps/desktop/tests/**/*.test.ts?(x)', 'services/*/tests/**/*.test.ts'],
      exclude: ['packages/*/tests/**/*.contract.test.ts', 'services/*/tests/**/*.contract.test.ts']
    }
  },
  {
    resolve: { alias: sourceAliases },
    test: {
      name: 'contract',
      include: ['packages/*/tests/**/*.contract.test.ts', 'services/*/tests/**/*.contract.test.ts']
    }
  }
]);
