import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuthConfig } from './auth.config.js';
import { seedUserDefaults } from './defaults.js';

/** Compte créé par la migration : propriétaire des données d'avant les comptes. */
export const INITIAL_ACCOUNT_EMAIL = 'compte-initial@search-job.local';

export type GoogleProfile = {
  sub: string;
  email: string;
  name: string | null;
  picture: string | null;
};

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AuthConfig,
  ) {}

  /**
   * Utilisateur correspondant à un compte Google (l'adresse a déjà été autorisée).
   * Créé au premier passage, avec ses étapes et listes de départ.
   */
  async signIn(profile: GoogleProfile) {
    const email = profile.email.toLowerCase();
    const data = {
      email,
      name: profile.name,
      picture: profile.picture,
      lastLoginAt: new Date(),
    };

    const known = await this.prisma.user.findUnique({
      where: { googleSub: profile.sub },
    });
    if (known) {
      return this.prisma.user.update({ where: { id: known.id }, data });
    }

    const sameEmail = await this.prisma.user.findUnique({ where: { email } });
    if (sameEmail) {
      // Même adresse, autre compte Google (compte supprimé puis recréé ?) : on ne
      // rattache pas les données sans vérification.
      if (sameEmail.googleSub) {
        throw new ForbiddenException(
          'Cette adresse est déjà liée à un autre compte Google.',
        );
      }
      return this.prisma.user.update({
        where: { id: sameEmail.id },
        data: { ...data, googleSub: profile.sub },
      });
    }

    // Première connexion du propriétaire : il reprend les données existantes.
    if (this.config.isOwner(email)) {
      const initial = await this.prisma.user.findFirst({
        where: { email: INITIAL_ACCOUNT_EMAIL, googleSub: null },
      });
      if (initial) {
        return this.prisma.user.update({
          where: { id: initial.id },
          data: { ...data, googleSub: profile.sub },
        });
      }
    }

    return this.create({ ...data, googleSub: profile.sub });
  }

  /** Nouvel utilisateur, avec ses étapes et listes de départ. */
  create(data: {
    email: string;
    googleSub?: string | null;
    name?: string | null;
    picture?: string | null;
    lastLoginAt?: Date | null;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({ data });
      await seedUserDefaults(tx, user.id);
      return user;
    });
  }
}
