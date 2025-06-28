import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    silent: "passed-only",
    setupFiles: ['./source/vitest.setup.js'],
  },
  resolve: {
    alias: {
      'vitest-chrome': import.meta.resolve('vitest-chrome/lib/index.esm.js'),
    },
  },
});
