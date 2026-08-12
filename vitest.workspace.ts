import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  {
    test: {
      name: 'unit',
      include: ['packages/*/tests/**/*.test.ts', 'apps/desktop/tests/**/*.test.ts?(x)']
    }
  },
  {
    test: {
      name: 'contract',
      include: ['packages/*/tests/**/*.contract.test.ts']
    }
  }
]);
