import { fileURLToPath, URL } from 'node:url';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base so the bundle works at any subpath (e.g. GitLab Pages
  // serves us from /loan-ledger/).
  base: './',
  plugins: [vue()],
  resolve: {
    // Order matters: more specific aliases first so the literal-prefix
    // matcher doesn't try to append paths to `index.ts`.
    alias: [
      {
        find: '@loan-ledger/ui/style/tokens.css',
        replacement: fileURLToPath(new URL('../ui/src/style/tokens.css', import.meta.url)),
      },
      {
        find: '@loan-ledger/ui/style/typography.css',
        replacement: fileURLToPath(new URL('../ui/src/style/typography.css', import.meta.url)),
      },
      {
        find: '@loan-ledger/ui',
        replacement: fileURLToPath(new URL('../ui/src/index.ts', import.meta.url)),
      },
      {
        find: '@loan-ledger/core',
        replacement: fileURLToPath(new URL('../core/src/index.ts', import.meta.url)),
      },
      {
        find: '@',
        replacement: fileURLToPath(new URL('./src', import.meta.url)),
      },
    ],
  },
  build: {
    target: 'es2023',
    sourcemap: true,
  },
});
