import { existsSync, mkdirSync, renameSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import vue from '@vitejs/plugin-vue';
import { defineConfig, type Plugin } from 'vite';

/**
 * Output layout matches Nextcloud's `Util::addScript` and `Util::addStyle`
 * conventions: JS lands in `js/loanledger-main.js`, CSS lands in
 * `css/loanledger-main.css`. We collapse to a single chunk via
 * `inlineDynamicImports` so the PHP page controller only references one
 * script tag and one stylesheet. After Vite emits, a small `closeBundle`
 * plugin moves the CSS files out of `js/` and into a sibling `css/`
 * directory; rolldown's `assetFileNames` doesn't accept relative paths.
 */
const splitCssOut = (): Plugin => ({
  name: 'loan-ledger:split-css-out',
  closeBundle() {
    const here = fileURLToPath(new URL('.', import.meta.url));
    const moves: Array<[string, string]> = [
      ['js/loanledger-main.css', 'css/loanledger-main.css'],
      ['js/loanledger-main.css.map', 'css/loanledger-main.css.map'],
    ];
    rmSync(resolve(here, 'css'), { recursive: true, force: true });
    for (const [src, dest] of moves) {
      const srcPath = resolve(here, src);
      const destPath = resolve(here, dest);
      if (!existsSync(srcPath)) continue;
      mkdirSync(dirname(destPath), { recursive: true });
      renameSync(srcPath, destPath);
    }
  },
});

export default defineConfig({
  base: '',
  plugins: [vue(), splitCssOut()],
  resolve: {
    alias: [
      {
        find: '@loan-ledger/ui/style/tokens.css',
        replacement: fileURLToPath(new URL('../ui/src/style/tokens.css', import.meta.url)),
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
    outDir: 'js',
    emptyOutDir: true,
    rollupOptions: {
      input: fileURLToPath(new URL('./src/main.ts', import.meta.url)),
      output: {
        inlineDynamicImports: true,
        // .mjs (not .js) so Nextcloud's JSResourceLocator emits the
        // `<script type="module">` tag that lets `import.meta` parse.
        entryFileNames: 'loanledger-main.mjs',
        assetFileNames: (info) => {
          const cssName = info.names?.find((n) => n.endsWith('.css'));
          if (cssName) return 'loanledger-main[extname]';
          return 'assets/[name]-[hash][extname]';
        },
      },
    },
  },
});
