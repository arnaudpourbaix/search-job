import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

/** Listes modifiables et le champ qui stocke leurs valeurs. */
export const LIST_CATEGORIES = [
  'PLATFORM',
  'CONTRACT_TYPE',
  'INTERMEDIARY_TYPE',
  'CHANNEL',
  'INTERVIEW_TYPE',
] as const;
export type ListCategory = (typeof LIST_CATEGORIES)[number];

type Db = PrismaService | Prisma.TransactionClient;

/** Nombre d'utilisations de chaque valeur, par catégorie. */
async function usageByValue(
  db: Db,
  userId: number,
  category: ListCategory,
): Promise<Map<string, number>> {
  if (category === 'INTERVIEW_TYPE') {
    const rows = await db.interview.groupBy({
      by: ['type'],
      where: { opportunity: { userId } },
      _count: { _all: true },
    });
    return new Map(rows.map((r) => [r.type, r._count._all]));
  }
  const rows =
    category === 'CHANNEL'
      ? (
          await db.interaction.groupBy({
            by: ['channel'],
            where: { channel: { not: null }, opportunity: { userId } },
            _count: { _all: true },
          })
        ).map((r) => [r.channel, r._count._all] as const)
      : (
          await db.opportunity.groupBy({
            by: [fieldOf(category)],
            where: { userId, [fieldOf(category)]: { not: null } },
            _count: { _all: true },
          })
        ).map(
          (r) =>
            [
              (r as Record<string, unknown>)[fieldOf(category)] as string,
              r._count._all,
            ] as const,
        );
  return new Map(rows.filter((r): r is [string, number] => r[0] !== null));
}

function fieldOf(
  category: Exclude<ListCategory, 'CHANNEL' | 'INTERVIEW_TYPE'>,
): 'platform' | 'contractType' | 'intermediaryType';
function fieldOf(category: ListCategory): string;
function fieldOf(category: ListCategory) {
  switch (category) {
    case 'PLATFORM':
      return 'platform';
    case 'CONTRACT_TYPE':
      return 'contractType';
    case 'INTERMEDIARY_TYPE':
      return 'intermediaryType';
    case 'CHANNEL':
      return 'channel';
    case 'INTERVIEW_TYPE':
      return 'type';
  }
}

/** Remplace une valeur par une autre dans les pistes / échanges qui l'utilisent. */
async function replaceValue(
  db: Db,
  userId: number,
  category: ListCategory,
  from: string,
  to: string,
): Promise<number> {
  if (category === 'INTERVIEW_TYPE') {
    const { count } = await db.interview.updateMany({
      where: { type: from, opportunity: { userId } },
      data: { type: to },
    });
    return count;
  }
  if (category === 'CHANNEL') {
    const { count } = await db.interaction.updateMany({
      where: { channel: from, opportunity: { userId } },
      data: { channel: to },
    });
    return count;
  }
  const field = fieldOf(category);
  const { count } = await db.opportunity.updateMany({
    where: { userId, [field]: from },
    data: { [field]: to },
  });
  return count;
}

const sameValue = (a: string, b: string) =>
  a.localeCompare(b, 'fr', { sensitivity: 'base' }) === 0;

@Injectable()
export class ListsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Toutes les listes, avec l'usage de chaque valeur et les valeurs hors liste. */
  async getAll(userId: number) {
    const rows = await this.prisma.refList.findMany({
      where: { userId },
      orderBy: [{ order: 'asc' }, { id: 'asc' }],
    });
    return Promise.all(
      LIST_CATEGORIES.map(async (category) => {
        const usage = await usageByValue(this.prisma, userId, category);
        const items = rows
          .filter((r) => r.category === category)
          .map((r) => ({
            id: r.id,
            value: r.value,
            order: r.order,
            usage: usage.get(r.value) ?? 0,
          }));
        const listed = new Set(items.map((i) => i.value));
        const unlisted = [...usage]
          .filter(([value]) => !listed.has(value))
          .map(([value, count]) => ({ value, usage: count }))
          .sort((a, b) => b.usage - a.usage || a.value.localeCompare(b.value));
        return { category, items, unlisted };
      }),
    );
  }

  private async assertUnique(
    db: Db,
    userId: number,
    category: ListCategory,
    value: string,
    exceptId?: number,
  ) {
    const values = await db.refList.findMany({
      where: {
        userId,
        category,
        NOT: exceptId ? { id: exceptId } : undefined,
      },
      select: { value: true },
    });
    if (values.some((v) => sameValue(v.value, value))) {
      throw new ConflictException(`« ${value} » existe déjà dans cette liste.`);
    }
  }

  async add(userId: number, category: ListCategory, value: string) {
    await this.assertUnique(this.prisma, userId, category, value);
    const last = await this.prisma.refList.aggregate({
      where: { userId, category },
      _max: { order: true },
    });
    const item = await this.prisma.refList.create({
      data: { userId, category, value, order: (last._max.order ?? -1) + 1 },
    });
    return {
      id: item.id,
      category: item.category,
      value: item.value,
      order: item.order,
    };
  }

  /** Renomme une valeur et la répercute sur les pistes / échanges qui l'utilisent. */
  async rename(userId: number, id: number, value: string) {
    return this.prisma.$transaction(async (tx) => {
      const item = await tx.refList.findFirst({ where: { id, userId } });
      if (!item) throw new NotFoundException('Valeur introuvable');
      const category = item.category as ListCategory;
      await this.assertUnique(tx, userId, category, value, id);
      await tx.refList.update({ where: { id }, data: { value } });
      const updated =
        item.value === value
          ? 0
          : await replaceValue(tx, userId, category, item.value, value);
      return { id, value, updated };
    });
  }

  /** Nouvel ordre : la liste complète des identifiants de la catégorie. */
  async reorder(userId: number, category: ListCategory, ids: number[]) {
    await this.prisma.$transaction(async (tx) => {
      const current = await tx.refList.findMany({
        where: { userId, category },
        select: { id: true },
      });
      const expected = new Set(current.map((c) => c.id));
      if (
        ids.length !== expected.size ||
        new Set(ids).size !== ids.length ||
        ids.some((id) => !expected.has(id))
      ) {
        throw new BadRequestException(
          'Le nouvel ordre doit contenir exactement les valeurs de la liste.',
        );
      }
      for (const [order, id] of ids.entries()) {
        await tx.refList.update({ where: { id }, data: { order } });
      }
    });
  }

  /**
   * Supprime une valeur de la liste. Les pistes / échanges qui l'utilisent la
   * conservent (elle apparaît alors « hors liste »), sauf si `replaceWith` est donné.
   */
  async remove(userId: number, id: number, replaceWith?: string) {
    return this.prisma.$transaction(async (tx) => {
      const item = await tx.refList.findFirst({ where: { id, userId } });
      if (!item) throw new NotFoundException('Valeur introuvable');
      const category = item.category as ListCategory;
      let updated = 0;
      if (replaceWith) {
        const target = await tx.refList.findFirst({
          where: { userId, category, value: replaceWith, NOT: { id } },
        });
        if (!target) {
          throw new BadRequestException(
            `« ${replaceWith} » ne fait pas partie de la liste.`,
          );
        }
        updated = await replaceValue(
          tx,
          userId,
          category,
          item.value,
          replaceWith,
        );
      }
      await tx.refList.delete({ where: { id } });
      return { updated };
    });
  }
}
