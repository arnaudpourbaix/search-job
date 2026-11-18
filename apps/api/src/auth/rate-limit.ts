import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';

/**
 * Limitation du nombre de requêtes, en mémoire, par adresse IP et par route.
 * Remplace @nestjs/throttler, publié en CommonJS : il charge @nestjs/common
 * (ESM uniquement) avec require(), ce que le runtime Vercel refuse.
 */
export interface RateLimitOptions {
  /** Nombre de requêtes autorisées par fenêtre. */
  limit: number;
  /** Durée de la fenêtre, en millisecondes. */
  ttl: number;
}

/** Limite large pour l'usage normal. */
export const DEFAULT_RATE_LIMIT: RateLimitOptions = {
  limit: 1000,
  ttl: 60_000,
};

const RATE_LIMIT = 'rateLimit';

/** Limite propre à un contrôleur ou à une route (remplace la limite par défaut). */
export const RateLimit = (options: RateLimitOptions) =>
  SetMetadata(RATE_LIMIT, options);

interface Window {
  count: number;
  resetAt: number;
}

/** Au-delà de ce nombre de compteurs, on purge les fenêtres expirées. */
const PRUNE_THRESHOLD = 10_000;

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly windows = new Map<string, Window>();

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') return true;
    const { limit, ttl } =
      this.reflector.getAllAndOverride<RateLimitOptions | undefined>(
        RATE_LIMIT,
        [context.getHandler(), context.getClass()],
      ) ?? DEFAULT_RATE_LIMIT;

    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const key = `${req.ip ?? 'unknown'}:${context.getClass().name}.${context.getHandler().name}`;
    const now = Date.now();

    let window = this.windows.get(key);
    if (!window || window.resetAt <= now) {
      if (this.windows.size >= PRUNE_THRESHOLD) this.prune(now);
      window = { count: 0, resetAt: now + ttl };
      this.windows.set(key, window);
    }
    window.count++;

    if (window.count > limit) {
      const retryAfter = Math.ceil((window.resetAt - now) / 1000);
      http.getResponse<Response>().setHeader('Retry-After', String(retryAfter));
      throw new HttpException(
        'Trop de requêtes, réessayez dans un instant',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }

  private prune(now: number) {
    for (const [key, window] of this.windows) {
      if (window.resetAt <= now) this.windows.delete(key);
    }
  }
}
