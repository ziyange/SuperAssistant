import eslint from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

export default [
  {
    ignores: ['**/node_modules/**', '**/dist/**', '**/playwright-report/**', '**/test-results/**']
  },
  eslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        sourceType: 'module'
      }
    },
    plugins: {
      '@typescript-eslint': tseslint
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { 'argsIgnorePattern': '^_' }]
    }
  },
  {
    // The TypeScript-aware rule remains enabled; the base rule misreads type-only parameters.
    files: [
      'apps/desktop/src/main/team-client.ts',
      'apps/desktop/src/main/team-ipc.ts',
      'apps/desktop/src/preload/team-api.ts',
      'services/team/src/retention-operation-service.ts',
      'services/team/src/team-audit-export-service.ts'
    ],
    rules: { 'no-unused-vars': 'off' }
  }
];
