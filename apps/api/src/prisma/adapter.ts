import { PrismaPg } from '@prisma/adapter-pg';

/**
 * Explicite sslmode=verify-full (comportement actuel de pg pour « require »),
 * ce qui évite l'avertissement de pg sur le changement de sémantique à venir.
 */
export function withVerifiedSsl(url: string): string {
  const parsed = new URL(url);
  if (parsed.searchParams.get('sslmode') === 'require') {
    parsed.searchParams.set('sslmode', 'verify-full');
  }
  return parsed.toString();
}

/** Adaptateur Postgres (Neon) : l'application passe par l'URL poolée DATABASE_URL. */
export function createPrismaAdapter(): PrismaPg {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL manquante (voir apps/api/.env.example)');
  }
  return new PrismaPg({ connectionString: withVerifiedSsl(connectionString) });
}
