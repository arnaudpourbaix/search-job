import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Response } from 'express';
import { AuthConfig } from './auth.config.js';
import { type AuthedRequest, IS_PUBLIC } from './auth.decorators.js';
import { readCookie } from './cookies.js';
import { SessionsService } from './sessions.service.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Garde globale : toute route exige une session valide, sauf celles marquées @Public().
 * Une route ajoutée plus tard est donc protégée par défaut.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionsService,
    private readonly config: AuthConfig,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (ctx.getType() !== 'http') return true;
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const res = ctx.switchToHttp().getResponse<Response>();

    // Anti-CSRF, en plus des cookies SameSite=Lax : une requête qui modifie des
    // données doit venir du site lui-même.
    const origin = req.headers.origin;
    if (
      !SAFE_METHODS.has(req.method) &&
      origin &&
      origin !== this.config.appUrl.origin
    ) {
      throw new ForbiddenException('Origine de la requête refusée');
    }

    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(
      IS_PUBLIC,
      [ctx.getHandler(), ctx.getClass()],
    );
    if (isPublic) return true;

    const token = readCookie(req, this.sessions.cookieName);
    const session = token ? await this.sessions.validate(token) : null;
    if (!token || !session) {
      throw new UnauthorizedException('Connexion requise');
    }
    if (session.renewedUntil) {
      this.sessions.setCookie(res, token, session.renewedUntil);
    }
    req.user = session.user;
    return true;
  }
}
