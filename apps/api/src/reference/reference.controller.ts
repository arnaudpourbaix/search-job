import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

/** Données de référence pour les formulaires (listes, autocomplétion). */
@Controller()
export class ReferenceController {
  constructor(private readonly prisma: PrismaService) {}

  /** { PLATFORM, CONTRACT_TYPE, CHANNEL, INTERMEDIARY_TYPE, INTERVIEW_TYPE } : listes de valeurs */
  @Get('ref-lists')
  async refLists() {
    const rows = await this.prisma.refList.findMany({
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
  companies() {
    return this.prisma.company.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
  }

  @Get('tags')
  async tags() {
    const tags = await this.prisma.tag.findMany({ orderBy: { name: 'asc' } });
    return tags.map((t) => t.name);
  }
}
