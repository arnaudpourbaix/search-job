import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { testDatabaseEnv } from './test-database.js';

/** Base Neon de test, vidée et remigrée à chaque lancement. */
export default function setup() {
  execSync('npx prisma migrate reset --force', {
    cwd: join(import.meta.dirname, '..'),
    env: { ...process.env, ...testDatabaseEnv() },
    stdio: 'ignore',
  });
}
