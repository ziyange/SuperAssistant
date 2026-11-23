import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist/renderer',
    emptyOutDir: true
  },
  resolve: {
    alias: {
      '@super-assistant/domain': fileURLToPath(new URL('../../packages/domain/src/index.ts', import.meta.url))
    }
  }
});
