import { Injectable, NotFoundException } from '@nestjs/common';
import { parseDay } from '../common/dates.js';
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

  private async assertOpportunity(id: number) {
    const exists = await this.prisma.opportunity.count({ where: { id } });
    if (!exists) throw new NotFoundException(`Piste ${id} introuvable`);
  }

  async addInteraction(opportunityId: number, dto: CreateInteractionDto) {
    await this.assertOpportunity(opportunityId);
    await this.prisma.interaction.create({
      data: {
        opportunityId,
        date: parseDay(dto.date),
        channel: dto.channel ?? null,
        summary: dto.summary,
      },
    });
    await this.touch(opportunityId);
  }

  async updateInteraction(id: number, dto: UpdateInteractionDto) {
    const { opportunityId } = await this.prisma.interaction.update({
      where: { id },
      data: {
        date: dto.date === undefined ? undefined : parseDay(dto.date),
        channel: dto.channel,
        summary: dto.summary,
      },
    });
    await this.touch(opportunityId);
  }

  async removeInteraction(id: number) {
    const { opportunityId } = await this.prisma.interaction.delete({
      where: { id },
    });
    await this.touch(opportunityId);
  }

  async addAction(opportunityId: number, dto: CreateActionDto) {
    await this.assertOpportunity(opportunityId);
    await this.prisma.action.create({
      data: {
        opportunityId,
        label: dto.label,
        dueDate: dto.dueDate ? parseDay(dto.dueDate) : null,
      },
    });
    await this.touch(opportunityId);
  }

  async updateAction(id: number, dto: UpdateActionDto) {
    const dueDate =
      dto.dueDate === undefined
        ? undefined
        : dto.dueDate
          ? parseDay(dto.dueDate)
          : null;
    const doneAt =
      dto.done === undefined ? undefined : dto.done ? new Date() : null;
    const { opportunityId } = await this.prisma.action.update({
      where: { id },
      data: { label: dto.label, dueDate, doneAt },
    });
    await this.touch(opportunityId);
  }

  async removeAction(id: number) {
    const { opportunityId } = await this.prisma.action.delete({
      where: { id },
    });
    await this.touch(opportunityId);
  }
}
