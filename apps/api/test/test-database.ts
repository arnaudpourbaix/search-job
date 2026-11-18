import { config as loadEnv } from 'dotenv';
import { join } from 'node:path';

/** Base Neon dédiée aux tests e2e (même branche, base « <nom>_test »). */
const TEST_DATABASE_SUFFIX = '_test';

function toTestDatabase(url: string): string {
  const parsed = new URL(url);
  const name = parsed.pathname.replace(/^\//, '');
  if (!name.endsWith(TEST_DATABASE_SUFFIX)) {
    parsed.pathname = `/${name}${TEST_DATABASE_SUFFIX}`;
  }
  return parsed.toString();
}

/** Variables d'environnement pointant vers la base de test. */
export function testDatabaseEnv(): Record<string, string> {
  const env = {
    ...loadEnv({ path: join(import.meta.dirname, '..', '.env'), quiet: true })
      .parsed,
    ...process.env,
  };
  const pooled = env.DATABASE_URL;
  if (!pooled?.startsWith('postgres')) {
    throw new Error('DATABASE_URL (Neon) manquante dans apps/api/.env');
  }
  return {
    DATABASE_URL: toTestDatabase(pooled),
    DATABASE_URL_UNPOOLED: toTestDatabase(env.DATABASE_URL_UNPOOLED ?? pooled),
  };
}
