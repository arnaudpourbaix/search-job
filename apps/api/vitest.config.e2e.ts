import { defineConfig } from 'vitest/config';
import { testDatabaseEnv } from './test/test-database.js';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    globalSetup: ['./test/global-setup.ts'],
    // Les fichiers e2e partagent la même base : exécution séquentielle.
    fileParallelism: false,
    env: testDatabaseEnv(),
  },
});
