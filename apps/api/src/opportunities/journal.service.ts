import { Injectable, NotFoundException } from '@nestjs/common';
import { assertContacts, linkContacts } from '../common/contacts.js';
import { parseDay } from '../common/dates.js';
import { assertOpportunity } from '../common/ownership.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  CreateActionDto,
  CreateInteractionDto,
  UpdateActionDto,
  UpdateInteractionDto,
} from './dto.js';

/** Échanges (journal) et actions d'une piste. */
@Injectable()
export class JournalService {
  constructor(private readonly prisma: PrismaService) {}

  /** Met à jour updatedAt de la piste (tri « récemment modifiées »). */
  private async touch(opportunityId: number) {
    await this.prisma.opportunity.update({
      where: { id: opportunityId },
      data: { updatedAt: new Date() },
    });
  }

  /** Piste d'un échange de l'utilisateur, sinon 404. */
  private async interactionOwner(userId: number, id: number) {
    const found = await this.prisma.interaction.findFirst({
      where: { id, opportunity: { userId } },
      select: { opportunityId: true },
    });
    if (!found) throw new NotFoundException(`Échange ${id} introuvable`);
    return found.opportunityId;
  }

  /** Piste d'une action de l'utilisateur, sinon 404. */
  private async actionOwner(userId: number, id: number) {
    const found = await this.prisma.action.findFirst({
      where: { id, opportunity: { userId } },
      select: { opportunityId: true },
    });
    if (!found) throw new NotFoundException(`Action ${id} introuvable`);
    return found.opportunityId;
  }

  async addInteraction(
    userId: number,
    opportunityId: number,
    dto: CreateInteractionDto,
  ) {
    await assertOpportunity(this.prisma, userId, opportunityId);
    await this.prisma.$transaction(async (tx) => {
      const contactId = dto.contactId ?? null;
      if (contactId) await assertContacts(tx, userId, [contactId]);
      await tx.interaction.create({
        data: {
          opportunityId,
          date: parseDay(dto.date),
          channel: dto.channel ?? null,
          summary: dto.summary,
          answered: dto.answered ?? true,
          contactId,
        },
      });
      // L'interlocuteur fait partie des contacts de la piste.
      if (contactId) await linkContacts(tx, opportunityId, [contactId]);
    });
    await this.touch(opportunityId);
  }

  async updateInteraction(
    userId: number,
    id: number,
    dto: UpdateInteractionDto,
  ) {
    const opportunityId = await this.interactionOwner(userId, id);
    await this.prisma.$transaction(async (tx) => {
      if (dto.contactId) await assertContacts(tx, userId, [dto.contactId]);
      await tx.interaction.update({
        where: { id },
        data: {
          date: dto.date === undefined ? undefined : parseDay(dto.date),
          channel: dto.channel,
          summary: dto.summary,
          answered: dto.answered,
          contactId: dto.contactId,
        },
      });
      if (dto.contactId) {
        await linkContacts(tx, opportunityId, [dto.contactId]);
      }
    });
    await this.touch(opportunityId);
  }

  async removeInteraction(userId: number, id: number) {
    const opportunityId = await this.interactionOwner(userId, id);
    await this.prisma.interaction.delete({ where: { id } });
    await this.touch(opportunityId);
  }

  async addAction(userId: number, opportunityId: number, dto: CreateActionDto) {
    await assertOpportunity(this.prisma, userId, opportunityId);
    await this.prisma.action.create({
      data: {
        opportunityId,
        label: dto.label,
        dueDate: dto.dueDate ? parseDay(dto.dueDate) : null,
      },
    });
    await this.touch(opportunityId);
  }

  async updateAction(userId: number, id: number, dto: UpdateActionDto) {
    const opportunityId = await this.actionOwner(userId, id);
    const dueDate =
      dto.dueDate === undefined
        ? undefined
        : dto.dueDate
          ? parseDay(dto.dueDate)
          : null;
    const doneAt =
      dto.done === undefined ? undefined : dto.done ? new Date() : null;
    await this.prisma.action.update({
      where: { id },
      data: { label: dto.label, dueDate, doneAt },
    });
    await this.touch(opportunityId);
  }

  async removeAction(userId: number, id: number) {
    const opportunityId = await this.actionOwner(userId, id);
    await this.prisma.action.delete({ where: { id } });
    await this.touch(opportunityId);
  }
}
