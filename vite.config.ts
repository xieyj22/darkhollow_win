/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import type { Plugin } from 'vite';

// 批5 T4: drop .woff fallbacks (~110KB) — every @font-face lists woff2 first,
// so the .woff url is never requested by browsers; dangling urls in the css
// are harmless.
function dropWoff(): Plugin {
  return {
    name: 'drop-woff',
    generateBundle(_, bundle) {
      for (const name of Object.keys(bundle)) if (name.endsWith('.woff')) delete bundle[name];
    },
  };
}

export default defineConfig({
  root: '.',
  base: './',
  plugins: [dropWoff()],
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
  test: {
    environment: 'happy-dom',
    include: ['src/**/__tests__/*.test.ts'],
  },
});
