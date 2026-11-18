import { Controller, Get } from '@nestjs/common';
import { UserId } from '../auth/auth.decorators.js';
import { PrismaService } from '../prisma/prisma.service.js';

/** Données de référence pour les formulaires (listes, autocomplétion). */
@Controller()
export class ReferenceController {
  constructor(private readonly prisma: PrismaService) {}

  /** { PLATFORM, CONTRACT_TYPE, CHANNEL, INTERMEDIARY_TYPE, INTERVIEW_TYPE } : listes de valeurs */
  @Get('ref-lists')
  async refLists(@UserId() userId: number) {
    const rows = await this.prisma.refList.findMany({
      where: { userId },
      orderBy: [{ category: 'asc' }, { order: 'asc' }],
    });
    const lists: Record<string, string[]> = {
      PLATFORM: [],
      CONTRACT_TYPE: [],
      CHANNEL: [],
      INTERMEDIARY_TYPE: [],
      INTERVIEW_TYPE: [],
    };
    for (const row of rows) (lists[row.category] ??= []).push(row.value);
    return lists;
  }

  @Get('companies')
  companies(@UserId() userId: number) {
    return this.prisma.company.findMany({
      where: { userId },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
  }

  @Get('tags')
  async tags(@UserId() userId: number) {
    const tags = await this.prisma.tag.findMany({
      where: { userId },
      orderBy: { name: 'asc' },
    });
    return tags.map((t) => t.name);
  }
}
