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

@Injectable()
export class StagesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Étapes dans l'ordre du pipeline, avec le nombre de pistes de chacune. */
  async list() {
    const [stages, counts] = await Promise.all([
      this.prisma.pipelineStage.findMany({ orderBy: [...ORDER] }),
      this.prisma.opportunity.groupBy({
        by: ['stageId'],
        _count: { _all: true },
      }),
    ]);
    return stages.map((s) => ({
      ...s,
      usage: counts.find((c) => c.stageId === s.id)?._count._all ?? 0,
    }));
  }

  async add(input: Required<Pick<StageInput, 'label'>> & StageInput) {
    await this.assertUnique(this.prisma, input.label);
    const last = await this.prisma.pipelineStage.aggregate({
      _max: { order: true },
    });
    return this.prisma.pipelineStage.create({
      data: {
        label: input.label,
        color: input.color ?? 'gray',
        kind: input.kind ?? StageKind.OPEN,
        order: (last._max.order ?? -1) + 1,
      },
    });
  }

  async update(id: number, input: StageInput) {
    return this.prisma.$transaction(async (tx) => {
      const current = await this.find(tx, id);
      if (input.label !== undefined) {
        await this.assertUnique(tx, input.label, id);
      }
      if (input.kind && CLOSED_KINDS.includes(input.kind)) {
        await this.assertOpenStageRemains(tx, id);
      }
      return tx.pipelineStage.update({
        where: { id: current.id },
        data: input,
      });
    });
  }

  /** Nouvel ordre : la liste complète des identifiants est exigée. */
  async reorder(ids: number[]) {
    const existing = await this.prisma.pipelineStage.findMany({
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
  async remove(id: number, replaceWith?: number) {
    return this.prisma.$transaction(async (tx) => {
      await this.find(tx, id);
      await this.assertOpenStageRemains(tx, id);
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
        const target = await tx.pipelineStage.findUnique({
          where: { id: replaceWith },
        });
        if (!target) {
          throw new BadRequestException('Étape de remplacement introuvable.');
        }
        ({ count: updated } = await tx.opportunity.updateMany({
          where: { stageId: id },
          data: { stageId: replaceWith },
        }));
      }
      await tx.pipelineStage.delete({ where: { id } });
      return { updated };
    });
  }

  private async find(tx: Prisma.TransactionClient, id: number) {
    const stage = await tx.pipelineStage.findUnique({ where: { id } });
    if (!stage) throw new NotFoundException(`Étape ${id} introuvable`);
    return stage;
  }

  private async assertUnique(
    tx: Prisma.TransactionClient,
    label: string,
    exceptId?: number,
  ) {
    const all = await tx.pipelineStage.findMany({
      where: exceptId ? { id: { not: exceptId } } : {},
      select: { label: true },
    });
    if (all.some((s) => sameLabel(s.label, label))) {
      throw new ConflictException(`L'étape « ${label} » existe déjà.`);
    }
  }

  /** Il doit toujours rester au moins une étape en cours (sinon, où créer une piste ?). */
  private async assertOpenStageRemains(
    tx: Prisma.TransactionClient,
    leavingId: number,
  ) {
    const others = await tx.pipelineStage.count({
      where: { id: { not: leavingId }, kind: { notIn: CLOSED_KINDS } },
    });
    if (!others) {
      throw new BadRequestException(
        'Il faut garder au moins une étape « en cours » ou « avancée ».',
      );
    }
  }
}
