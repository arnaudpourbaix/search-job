import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Racine du package API (fonctionne depuis src/ comme depuis dist/). */
export const API_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
