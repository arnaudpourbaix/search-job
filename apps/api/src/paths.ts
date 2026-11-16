import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Racine du package API (fonctionne depuis src/ comme depuis dist/). */
export const API_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Résout une URL SQLite « file:./x.db » par rapport à la racine de l'API. */
export function resolveSqliteUrl(url: string): string {
  const path = url.replace(/^file:/, '');
  return isAbsolute(path) ? url : `file:${resolve(API_ROOT, path)}`;
}
