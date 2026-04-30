import { fileURLToPath, URL } from 'node:url';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base so the bundle works at any subpath (e.g. GitLab Pages
  // serves us from /loan-ledger/).
  base: './',
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@loan-ledger/core': fileURLToPath(new URL('../core/src/index.ts', import.meta.url)),
      '@loan-ledger/ui': fileURLToPath(new URL('../ui/src/index.ts', import.meta.url)),
    },
  },
  build: {
    target: 'es2023',
    sourcemap: true,
  },
});
