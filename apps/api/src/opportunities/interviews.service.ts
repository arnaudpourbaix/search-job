import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { assertContacts, linkContacts } from '../common/contacts.js';
import { parseDay } from '../common/dates.js';
import { assertOpportunity } from '../common/ownership.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateInterviewDto, UpdateInterviewDto } from './dto.js';

/** undefined = inchangé, null ou vide = effacé. */
const dayOrNull = (v: string | null | undefined) =>
  v === undefined ? undefined : v ? parseDay(v) : null;

/** Tours du processus de recrutement d'une piste. */
@Injectable()
export class InterviewsService {
  constructor(private readonly prisma: PrismaService) {}

  private async touch(opportunityId: number) {
    await this.prisma.opportunity.update({
      where: { id: opportunityId },
      data: { updatedAt: new Date() },
    });
  }

  /** Piste d'un tour de l'utilisateur, sinon 404. */
  private async owner(userId: number, id: number) {
    const found = await this.prisma.interview.findFirst({
      where: { id, opportunity: { userId } },
      select: { opportunityId: true },
    });
    if (!found) throw new NotFoundException(`Entretien ${id} introuvable`);
    return found.opportunityId;
  }

  /** Ajoute un tour à la fin du processus. */
  async add(userId: number, opportunityId: number, dto: CreateInterviewDto) {
    await assertOpportunity(this.prisma, userId, opportunityId);
    await this.prisma.$transaction(async (tx) => {
      const contactIds = await assertContacts(tx, userId, dto.contactIds ?? []);
      const last = await tx.interview.aggregate({
        where: { opportunityId },
        _max: { order: true },
      });
      await tx.interview.create({
        data: {
          opportunityId,
          order: (last._max.order ?? -1) + 1,
          type: dto.type,
          label: dto.label ?? null,
          date: dayOrNull(dto.date) ?? null,
          time: dto.time ?? null,
          status: dto.status,
          notes: dto.notes ?? null,
          contacts: { create: contactIds.map((contactId) => ({ contactId })) },
        },
      });
      // Les interlocuteurs font partie des contacts de la piste.
      await linkContacts(tx, opportunityId, contactIds);
    });
    await this.touch(opportunityId);
  }

  async update(userId: number, id: number, dto: UpdateInterviewDto) {
    const opportunityId = await this.owner(userId, id);
    await this.prisma.$transaction(async (tx) => {
      const contactIds =
        dto.contactIds && (await assertContacts(tx, userId, dto.contactIds));
      await tx.interview.update({
        where: { id },
        data: {
          type: dto.type,
          label: dto.label,
          date: dayOrNull(dto.date),
          time: dto.time,
          status: dto.status,
          notes: dto.notes,
          // Liste complète : les interlocuteurs déjà présents gardent leur ordre.
          contacts: contactIds && {
            deleteMany: { contactId: { notIn: contactIds } },
            createMany: {
              data: contactIds.map((contactId) => ({ contactId })),
              skipDuplicates: true,
            },
          },
        },
      });
      if (contactIds) await linkContacts(tx, opportunityId, contactIds);
    });
    await this.touch(opportunityId);
  }

  async remove(userId: number, id: number) {
    const opportunityId = await this.owner(userId, id);
    await this.prisma.interview.delete({ where: { id } });
    await this.touch(opportunityId);
  }

  /** Nouvel ordre : la liste complète des tours de la piste. */
  async reorder(userId: number, opportunityId: number, ids: number[]) {
    await assertOpportunity(this.prisma, userId, opportunityId);
    await this.prisma.$transaction(async (tx) => {
      const current = await tx.interview.findMany({
        where: { opportunityId },
        select: { id: true },
      });
      const expected = new Set(current.map((c) => c.id));
      if (
        ids.length !== expected.size ||
        new Set(ids).size !== ids.length ||
        ids.some((id) => !expected.has(id))
      ) {
        throw new BadRequestException(
          'Le nouvel ordre doit contenir exactement les tours de la piste.',
        );
      }
      for (const [order, id] of ids.entries()) {
        await tx.interview.update({ where: { id }, data: { order } });
      }
    });
    await this.touch(opportunityId);
  }
}
