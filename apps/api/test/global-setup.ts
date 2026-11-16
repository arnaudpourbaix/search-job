import { execSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { join } from 'node:path';

/** Base SQLite dédiée aux tests e2e, recréée à chaque lancement. */
export default function setup() {
  const root = join(import.meta.dirname, '..');
  rmSync(join(root, 'test.db'), { force: true });
  execSync('npx prisma migrate deploy', {
    cwd: root,
    env: { ...process.env, DATABASE_URL: 'file:./test.db' },
    stdio: 'ignore',
  });
}
