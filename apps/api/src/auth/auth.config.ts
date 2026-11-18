import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Réglages de la connexion, lus dans l'environnement (apps/api/.env). */
@Injectable()
export class AuthConfig {
  /** Adresse publique du site (front), ex. http://localhost:5173 ou https://… */
  readonly appUrl: URL;
  readonly googleClientId: string | undefined;
  readonly googleClientSecret: string | undefined;
  /** Adresses autorisées à se connecter (en minuscules). Vide = personne. */
  readonly allowedEmails: string[];

  constructor(config: ConfigService) {
    this.appUrl = new URL(
      config.get<string>('APP_URL') || 'http://localhost:5173',
    );
    this.googleClientId = config.get<string>('GOOGLE_CLIENT_ID') || undefined;
    this.googleClientSecret =
      config.get<string>('GOOGLE_CLIENT_SECRET') || undefined;
    this.allowedEmails = (config.get<string>('ALLOWED_EMAILS') ?? '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
  }

  /** Cookies « Secure » dès que le site est servi en HTTPS. */
  get secure() {
    return this.appUrl.protocol === 'https:';
  }

  get googleConfigured() {
    return !!(this.googleClientId && this.googleClientSecret);
  }

  /** Adresse de retour déclarée chez Google (sur le même domaine que le front). */
  get redirectUri() {
    return new URL('/api/auth/google/callback', this.appUrl).toString();
  }

  isAllowed(email: string) {
    return this.allowedEmails.includes(email.toLowerCase());
  }

  /** Seule la première adresse autorisée reprend les données créées avant les comptes. */
  isOwner(email: string) {
    return this.allowedEmails[0] === email.toLowerCase();
  }
}
