import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    globalSetup: ['./test/global-setup.ts'],
    // Les fichiers e2e partagent la même base : exécution séquentielle.
    fileParallelism: false,
    env: { DATABASE_URL: 'file:./test.db' },
  },
});
