import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { StageKind } from '../generated/prisma/enums.js';
import { addDays, formatDay, parseDay, today } from '../common/dates.js';
import { CLOSED_KINDS } from '../common/stages.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateCampaignDto, UpdateCampaignDto } from './campaigns.dto.js';

type CampaignRow = {
  id: number;
  name: string;
  goal: string | null;
  startDate: Date;
  endDate: Date | null;
};

@Injectable()
export class CampaignsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Campagnes en cours d'abord, puis les plus récentes ; avec leurs chiffres clés. */
  async list(userId: number) {
    const [campaigns, counts, stages] = await Promise.all([
      this.prisma.campaign.findMany({
        where: { userId },
        orderBy: [{ startDate: 'desc' }, { id: 'desc' }],
      }),
      this.prisma.opportunity.groupBy({
        by: ['campaignId', 'stageId'],
        where: { userId },
        _count: { _all: true },
      }),
      this.prisma.pipelineStage.findMany({
        where: { userId },
        select: { id: true, kind: true },
      }),
    ]);
    const kindOf = new Map(stages.map((s) => [s.id, s.kind]));
    const stats = (id: number) => {
      const rows = counts.filter((c) => c.campaignId === id);
      const sum = (pred: (kind: StageKind) => boolean) =>
        rows
          .filter((r) => pred(kindOf.get(r.stageId)!))
          .reduce((n, r) => n + r._count._all, 0);
      return {
        total: sum(() => true),
        active: sum((k) => !CLOSED_KINDS.includes(k)),
        won: sum((k) => k === StageKind.WON),
      };
    };
    return campaigns
      .sort((a, b) => Number(!!a.endDate) - Number(!!b.endDate))
      .map((c) => ({ ...this.toDto(c), ...stats(c.id) }));
  }

  async create(userId: number, dto: CreateCampaignDto) {
    const start = dto.startDate ? parseDay(dto.startDate) : today();
    const created = await this.prisma.$transaction(async (tx) => {
      if (dto.closeOthers) {
        // Fin la veille du début, sans précéder le début de la campagne close.
        const open = await tx.campaign.findMany({
          where: { userId, endDate: null },
        });
        for (const c of open) {
          const end = addDays(start, -1);
          await tx.campaign.update({
            where: { id: c.id },
            data: { endDate: end < c.startDate ? c.startDate : end },
          });
        }
      }
      return tx.campaign.create({
        data: {
          userId,
          name: dto.name,
          goal: dto.goal ?? null,
          startDate: start,
        },
      });
    });
    return this.toDto(created);
  }

  async update(userId: number, id: number, dto: UpdateCampaignDto) {
    const current = await this.prisma.campaign.findFirst({
      where: { id, userId },
    });
    if (!current) throw new NotFoundException(`Campagne ${id} introuvable`);
    const startDate = dto.startDate
      ? parseDay(dto.startDate)
      : current.startDate;
    const endDate =
      dto.endDate === undefined
        ? current.endDate
        : dto.endDate && parseDay(dto.endDate);
    if (endDate && endDate < startDate) {
      throw new BadRequestException(
        'La date de fin doit suivre la date de début.',
      );
    }
    const updated = await this.prisma.campaign.update({
      where: { id },
      data: { name: dto.name, goal: dto.goal, startDate, endDate },
    });
    return this.toDto(updated);
  }

  /** Suppression réservée aux campagnes vides (les pistes ne sont jamais perdues). */
  async remove(userId: number, id: number) {
    const exists = await this.prisma.campaign.count({ where: { id, userId } });
    if (!exists) throw new NotFoundException(`Campagne ${id} introuvable`);
    const count = await this.prisma.opportunity.count({
      where: { campaignId: id },
    });
    if (count) {
      throw new ConflictException(
        `Campagne non vide (${count} piste${count > 1 ? 's' : ''}) : déplacer ses pistes avant de la supprimer.`,
      );
    }
    await this.prisma.campaign.delete({ where: { id } });
  }

  private toDto(c: CampaignRow) {
    return {
      id: c.id,
      name: c.name,
      goal: c.goal,
      startDate: formatDay(c.startDate),
      endDate: c.endDate && formatDay(c.endDate),
    };
  }
}
