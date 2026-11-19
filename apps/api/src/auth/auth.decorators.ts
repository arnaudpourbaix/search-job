import {
  createParamDecorator,
  type ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import type { Request } from 'express';

/** Utilisateur connecté, posé sur la requête par AuthGuard. */
export type AuthUser = {
  id: number;
  email: string;
  name: string | null;
  picture: string | null;
  /** Délai de relance (jours sans contact). */
  staleDays: number;
  /** Adresse de départ des itinéraires (null : non renseignée). */
  homeAddress: string | null;
};

export type AuthedRequest = Request & { user?: AuthUser };

export const IS_PUBLIC = 'isPublic';

/** Route accessible sans connexion (toutes les autres l'exigent). */
export const Public = () => SetMetadata(IS_PUBLIC, true);

const userOf = (ctx: ExecutionContext) => {
  const user = ctx.switchToHttp().getRequest<AuthedRequest>().user;
  // Impossible derrière AuthGuard ; protège d'une route @Public() qui l'utiliserait.
  if (!user) throw new Error('Route sans utilisateur connecté');
  return user;
};

/** Utilisateur connecté. */
export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext) => userOf(ctx),
);

/** Identifiant de l'utilisateur connecté : toutes les données sont filtrées dessus. */
export const UserId = createParamDecorator(
  (_: unknown, ctx: ExecutionContext) => userOf(ctx).id,
);
