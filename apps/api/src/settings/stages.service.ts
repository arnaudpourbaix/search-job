import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { StageKind } from '../generated/prisma/enums.js';
import { CLOSED_KINDS } from '../common/stages.js';
import { PrismaService } from '../prisma/prisma.service.js';

/** Couleurs proposées (palette Mantine). */
export const STAGE_COLORS = [
  'gray',
  'dark',
  'red',
  'pink',
  'grape',
  'violet',
  'indigo',
  'blue',
  'cyan',
  'teal',
  'green',
  'lime',
  'yellow',
  'orange',
] as const;

export type StageInput = { label?: string; color?: string; kind?: StageKind };

const sameLabel = (a: string, b: string) =>
  a.localeCompare(b, 'fr', { sensitivity: 'base' }) === 0;

const ORDER = [{ order: 'asc' }, { id: 'asc' }] as const;

/** Ce que renvoie l'API d'une étape (sans le propriétaire). */
const STAGE_SELECT = {
  id: true,
  label: true,
  color: true,
  order: true,
  kind: true,
} as const;

@Injectable()
export class StagesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Étapes dans l'ordre du pipeline, avec le nombre de pistes de chacune. */
  async list(userId: number) {
    const [stages, counts] = await Promise.all([
      this.prisma.pipelineStage.findMany({
        where: { userId },
        orderBy: [...ORDER],
      }),
      this.prisma.opportunity.groupBy({
        by: ['stageId'],
        where: { userId },
        _count: { _all: true },
      }),
    ]);
    return stages.map(({ userId: _owner, ...s }) => ({
      ...s,
      usage: counts.find((c) => c.stageId === s.id)?._count._all ?? 0,
    }));
  }

  async add(
    userId: number,
    input: Required<Pick<StageInput, 'label'>> & StageInput,
  ) {
    await this.assertUnique(this.prisma, userId, input.label);
    const last = await this.prisma.pipelineStage.aggregate({
      where: { userId },
      _max: { order: true },
    });
    return this.prisma.pipelineStage.create({
      select: STAGE_SELECT,
      data: {
        userId,
        label: input.label,
        color: input.color ?? 'gray',
        kind: input.kind ?? StageKind.OPEN,
        order: (last._max.order ?? -1) + 1,
      },
    });
  }

  async update(userId: number, id: number, input: StageInput) {
    return this.prisma.$transaction(async (tx) => {
      const current = await this.find(tx, userId, id);
      if (input.label !== undefined) {
        await this.assertUnique(tx, userId, input.label, id);
      }
      if (input.kind && CLOSED_KINDS.includes(input.kind)) {
        await this.assertOpenStageRemains(tx, userId, id);
      }
      return tx.pipelineStage.update({
        select: STAGE_SELECT,
        where: { id: current.id },
        data: input,
      });
    });
  }

  /** Nouvel ordre : la liste complète des identifiants est exigée. */
  async reorder(userId: number, ids: number[]) {
    const existing = await this.prisma.pipelineStage.findMany({
      where: { userId },
      select: { id: true },
    });
    const known = new Set(existing.map((s) => s.id));
    if (
      ids.length !== known.size ||
      new Set(ids).size !== ids.length ||
      ids.some((id) => !known.has(id))
    ) {
      throw new BadRequestException(
        "L'ordre doit contenir chaque étape exactement une fois.",
      );
    }
    await this.prisma.$transaction(
      ids.map((id, order) =>
        this.prisma.pipelineStage.update({ where: { id }, data: { order } }),
      ),
    );
  }

  /**
   * Supprime une étape. Si des pistes y sont, elles basculent vers replaceWith
   * (obligatoire dans ce cas).
   */
  async remove(userId: number, id: number, replaceWith?: number) {
    return this.prisma.$transaction(async (tx) => {
      const removed = await this.find(tx, userId, id);
      await this.assertOpenStageRemains(tx, userId, id);
      const usage = await tx.opportunity.count({ where: { stageId: id } });
      let updated = 0;
      if (usage) {
        if (!replaceWith) {
          throw new BadRequestException(
            `Étape utilisée par ${usage} piste${usage > 1 ? 's' : ''} : choisir l'étape qui la remplace.`,
          );
        }
        if (replaceWith === id) {
          throw new BadRequestException(
            "L'étape de remplacement doit être différente.",
          );
        }
        const target = await tx.pipelineStage.findFirst({
          where: { id: replaceWith, userId },
        });
        if (!target) {
          throw new BadRequestException('Étape de remplacement introuvable.');
        }
        const moved = await tx.opportunity.findMany({
          where: { stageId: id },
          select: { id: true },
        });
        ({ count: updated } = await tx.opportunity.updateMany({
          where: { stageId: id },
          data: { stageId: replaceWith },
        }));
        // Historique des pistes déplacées, avec le libellé de l'étape supprimée.
        await tx.stageChange.createMany({
          data: moved.map((o) => ({
            opportunityId: o.id,
            fromLabel: removed.label,
            toLabel: target.label,
            auto: true,
          })),
        });
      }
      await tx.pipelineStage.delete({ where: { id } });
      return { updated };
    });
  }

  private async find(tx: Prisma.TransactionClient, userId: number, id: number) {
    const stage = await tx.pipelineStage.findFirst({ where: { id, userId } });
    if (!stage) throw new NotFoundException(`Étape ${id} introuvable`);
    return stage;
  }

  private async assertUnique(
    tx: Prisma.TransactionClient,
    userId: number,
    label: string,
    exceptId?: number,
  ) {
    const all = await tx.pipelineStage.findMany({
      where: { userId, ...(exceptId ? { id: { not: exceptId } } : {}) },
      select: { label: true },
    });
    if (all.some((s) => sameLabel(s.label, label))) {
      throw new ConflictException(`L'étape « ${label} » existe déjà.`);
    }
  }

  /** Il doit toujours rester au moins une étape en cours (sinon, où créer une piste ?). */
  private async assertOpenStageRemains(
    tx: Prisma.TransactionClient,
    userId: number,
    leavingId: number,
  ) {
    const others = await tx.pipelineStage.count({
      where: {
        userId,
        id: { not: leavingId },
        kind: { notIn: CLOSED_KINDS },
      },
    });
    if (!others) {
      throw new BadRequestException(
        'Il faut garder au moins une étape « en cours » ou « avancée ».',
      );
    }
  }
}
