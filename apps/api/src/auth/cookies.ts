import type { CookieOptions, Request, Response } from 'express';

/** Lit un cookie de la requête (sans dépendance supplémentaire). */
export function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() === name) {
      try {
        return decodeURIComponent(part.slice(eq + 1).trim());
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}

/** Cookies HttpOnly (inaccessibles au JavaScript de la page) et SameSite=Lax. */
const base: CookieOptions = { httpOnly: true, sameSite: 'lax' };

export function setCookie(
  res: Response,
  name: string,
  value: string,
  options: CookieOptions,
) {
  res.cookie(name, value, { ...base, ...options });
}

export function clearCookie(
  res: Response,
  name: string,
  options: CookieOptions,
) {
  res.clearCookie(name, { ...base, ...options });
}
