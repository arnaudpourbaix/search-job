import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import type { Response } from 'express';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuthConfig } from './auth.config.js';
import type { AuthUser } from './auth.decorators.js';
import { clearCookie, setCookie } from './cookies.js';

const DAY = 86_400_000;
/** Durée d'une session ; prolongée à l'usage quand il en reste moins de la moitié. */
export const SESSION_DAYS = 30;

const hash = (token: string) =>
  createHash('sha256').update(token).digest('hex');

@Injectable()
export class SessionsService {
  private readonly logger = new Logger(SessionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AuthConfig,
  ) {}

  /** « __Host- » en HTTPS : cookie limité à ce domaine exact, jamais envoyé en clair. */
  get cookieName() {
    return this.config.secure ? '__Host-sid' : 'sid';
  }

  /** Crée une session et renvoie le jeton du cookie (seule son empreinte est stockée). */
  async create(userId: number) {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + SESSION_DAYS * DAY);
    await this.prisma.session.create({
      data: { id: hash(token), userId, expiresAt },
    });
    return { token, expiresAt };
  }

  /** Utilisateur d'une session valide (prolongée si besoin), sinon null. */
  async validate(
    token: string,
  ): Promise<{ user: AuthUser; renewedUntil: Date | null } | null> {
    const id = hash(token);
    const session = await this.prisma.session.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, email: true, name: true, picture: true } },
      },
    });
    if (!session) return null;
    const now = Date.now();
    if (session.expiresAt.getTime() <= now) {
      await this.prisma.session.deleteMany({ where: { id } });
      return null;
    }
    let renewedUntil: Date | null = null;
    if (session.expiresAt.getTime() - now < (SESSION_DAYS / 2) * DAY) {
      renewedUntil = new Date(now + SESSION_DAYS * DAY);
      await this.prisma.session.update({
        where: { id },
        data: { expiresAt: renewedUntil },
      });
    }
    return { user: session.user, renewedUntil };
  }

  async revoke(token: string) {
    await this.prisma.session.deleteMany({ where: { id: hash(token) } });
  }

  setCookie(res: Response, token: string, expiresAt: Date) {
    setCookie(res, this.cookieName, token, {
      secure: this.config.secure,
      path: '/',
      expires: expiresAt,
    });
  }

  clearCookie(res: Response) {
    clearCookie(res, this.cookieName, {
      secure: this.config.secure,
      path: '/',
    });
  }

  /** Ménage quotidien des sessions expirées. */
  @Cron('30 5 * * *')
  async purgeExpired() {
    try {
      await this.prisma.session.deleteMany({
        where: { expiresAt: { lte: new Date() } },
      });
    } catch (e) {
      this.logger.error('Purge des sessions impossible', e as Error);
    }
  }
}
