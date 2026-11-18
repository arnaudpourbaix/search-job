import {
  Controller,
  Get,
  HttpCode,
  Logger,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import * as oidc from 'openid-client';
import { AuthConfig } from './auth.config.js';
import { type AuthUser, CurrentUser, Public } from './auth.decorators.js';
import { RateLimit } from './rate-limit.js';
import { clearCookie, readCookie, setCookie } from './cookies.js';
import { SessionsService } from './sessions.service.js';
import { UsersService } from './users.service.js';

/** Cookie de la connexion en cours (state, nonce, vérificateur PKCE), 10 minutes. */
const FLOW_COOKIE = 'oauth_flow';
const FLOW_PATH = '/api/auth';
const FLOW_MAX_AGE = 10 * 60_000;

type Flow = { state: string; nonce: string; verifier: string };

/** Motif d'échec affiché par la page de connexion. */
type LoginError = 'config' | 'expired' | 'google' | 'forbidden';

/** Connexion Google (OpenID Connect, flux « code » avec PKCE) et session par cookie. */
@Controller('auth')
@RateLimit({ limit: 20, ttl: 60_000 })
export class AuthController {
  private readonly logger = new Logger(AuthController.name);
  private google?: Promise<oidc.Configuration>;

  constructor(
    private readonly config: AuthConfig,
    private readonly sessions: SessionsService,
    private readonly users: UsersService,
  ) {}

  /** Configuration Google (découverte au premier usage, puis gardée en mémoire). */
  private googleConfig() {
    this.google ??= oidc
      .discovery(
        new URL('https://accounts.google.com'),
        this.config.googleClientId!,
        this.config.googleClientSecret,
      )
      .catch((e: unknown) => {
        this.google = undefined;
        throw e;
      });
    return this.google;
  }

  private fail(res: Response, error: LoginError) {
    const url = new URL('/login', this.config.appUrl);
    url.searchParams.set('error', error);
    res.redirect(url.toString());
  }

  /** Démarre la connexion : redirige vers Google. */
  @Public()
  @Get('google')
  async start(@Res() res: Response) {
    if (!this.config.googleConfigured) return this.fail(res, 'config');
    const flow: Flow = {
      state: oidc.randomState(),
      nonce: oidc.randomNonce(),
      verifier: oidc.randomPKCECodeVerifier(),
    };
    let google: oidc.Configuration;
    try {
      google = await this.googleConfig();
    } catch (e) {
      this.logger.error('Google injoignable', e as Error);
      return this.fail(res, 'google');
    }
    setCookie(
      res,
      FLOW_COOKIE,
      Buffer.from(JSON.stringify(flow)).toString('base64url'),
      { secure: this.config.secure, path: FLOW_PATH, maxAge: FLOW_MAX_AGE },
    );
    const url = oidc.buildAuthorizationUrl(google, {
      redirect_uri: this.config.redirectUri,
      scope: 'openid email profile',
      state: flow.state,
      nonce: flow.nonce,
      code_challenge: await oidc.calculatePKCECodeChallenge(flow.verifier),
      code_challenge_method: 'S256',
      prompt: 'select_account',
    });
    res.redirect(url.toString());
  }

  /** Retour de Google : vérifie la réponse, l'adresse autorisée, puis ouvre la session. */
  @Public()
  @Get('google/callback')
  async callback(@Req() req: Request, @Res() res: Response) {
    const flow = this.readFlow(req);
    clearCookie(res, FLOW_COOKIE, {
      secure: this.config.secure,
      path: FLOW_PATH,
    });
    if (!flow) return this.fail(res, 'expired');
    if (!this.config.googleConfigured) return this.fail(res, 'config');

    let claims: oidc.IDToken | undefined;
    try {
      const tokens = await oidc.authorizationCodeGrant(
        await this.googleConfig(),
        new URL(req.originalUrl, this.config.appUrl),
        {
          pkceCodeVerifier: flow.verifier,
          expectedState: flow.state,
          expectedNonce: flow.nonce,
          idTokenExpected: true,
        },
      );
      claims = tokens.claims();
    } catch (e) {
      this.logger.warn(`Connexion Google refusée : ${(e as Error).message}`);
      return this.fail(res, 'google');
    }

    const email =
      typeof claims?.email === 'string' ? claims.email.toLowerCase() : null;
    // Adresse vérifiée par Google et présente dans la liste d'accès.
    if (
      !claims ||
      !email ||
      claims.email_verified !== true ||
      !this.config.isAllowed(email)
    ) {
      this.logger.warn(`Connexion refusée pour ${email ?? '(sans adresse)'}`);
      return this.fail(res, 'forbidden');
    }

    let userId: number;
    try {
      ({ id: userId } = await this.users.signIn({
        sub: claims.sub,
        email,
        name: typeof claims.name === 'string' ? claims.name : null,
        picture: typeof claims.picture === 'string' ? claims.picture : null,
      }));
    } catch (e) {
      this.logger.warn(`Connexion refusée pour ${email} : ${String(e)}`);
      return this.fail(res, 'forbidden');
    }
    const { token, expiresAt } = await this.sessions.create(userId);
    this.sessions.setCookie(res, token, expiresAt);
    res.redirect(new URL('/', this.config.appUrl).toString());
  }

  /** Utilisateur connecté (401 sinon : le front affiche alors la page de connexion). */
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return user;
  }

  /** Déconnexion : la session est supprimée côté serveur, pas seulement le cookie. */
  @Public()
  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = readCookie(req, this.sessions.cookieName);
    if (token) await this.sessions.revoke(token);
    this.sessions.clearCookie(res);
  }

  private readFlow(req: Request): Flow | null {
    const raw = readCookie(req, FLOW_COOKIE);
    if (!raw) return null;
    try {
      const flow = JSON.parse(
        Buffer.from(raw, 'base64url').toString(),
      ) as Partial<Flow>;
      return typeof flow.state === 'string' &&
        typeof flow.nonce === 'string' &&
        typeof flow.verifier === 'string'
        ? (flow as Flow)
        : null;
    } catch {
      return null;
    }
  }
}
