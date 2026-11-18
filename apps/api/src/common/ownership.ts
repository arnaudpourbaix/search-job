import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';

/**
 * Contrôles d'appartenance : un identifiant reçu du client n'est utilisé que s'il
 * désigne une donnée de l'utilisateur connecté. Une donnée d'un autre utilisateur
 * est traitée comme inexistante (404 / 400), sans révéler qu'elle existe.
 */
type Db = PrismaService | Prisma.TransactionClient;

/** Piste de l'utilisateur, sinon 404. */
export async function assertOpportunity(db: Db, userId: number, id: number) {
  const found = await db.opportunity.count({ where: { id, userId } });
  if (!found) throw new NotFoundException(`Piste ${id} introuvable`);
}

/** Campagne de l'utilisateur désignée dans un formulaire, sinon 400. */
export async function assertCampaign(db: Db, userId: number, id: number) {
  const found = await db.campaign.count({ where: { id, userId } });
  if (!found) throw new BadRequestException('Campagne introuvable.');
}

/** Étape de l'utilisateur désignée dans un formulaire, sinon 400. */
export async function assertStage(db: Db, userId: number, id: number) {
  const found = await db.pipelineStage.count({ where: { id, userId } });
  if (!found) throw new BadRequestException('Étape introuvable.');
}

/** Société désignée par son nom, créée si elle est inconnue de l'utilisateur. */
export async function companyIdByName(
  db: Prisma.TransactionClient,
  userId: number,
  name: string | null | undefined,
): Promise<number | null | undefined> {
  if (name === undefined || name === null) return name;
  const company = await db.company.upsert({
    where: { userId_name: { userId, name } },
    create: { userId, name },
    update: {},
    select: { id: true },
  });
  return company.id;
}
