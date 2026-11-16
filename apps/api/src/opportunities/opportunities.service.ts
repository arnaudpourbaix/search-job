import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { Stage } from '../generated/prisma/enums.js';
import { formatDay } from '../common/dates.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  CreateOpportunityDto,
  ListOpportunitiesQuery,
  UpdateOpportunityDto,
} from './dto.js';

export const CLOSED_STAGES: Stage[] = [
  Stage.WON,
  Stage.REJECTED,
  Stage.ABANDONED,
];

const MISSING_PARTY = "Renseigner au moins l'entreprise ou l'intermédiaire.";

const companyRef = { select: { id: true, name: true } } as const;
const contactRef = {
  select: { id: true, name: true, email: true, phone: true },
} as const;

const listInclude = {
  company: companyRef,
  intermediary: companyRef,
  contact: contactRef,
  tags: { select: { name: true }, orderBy: { name: 'asc' } },
  interactions: { select: { date: true } },
  actions: {
    where: { doneAt: null },
    select: { id: true, label: true, dueDate: true },
  },
} satisfies Prisma.OpportunityInclude;

const day = (d: Date | null) => (d ? formatDay(d) : null);

/** Tri des actions ouvertes : échéance la plus proche d'abord, sans date en dernier. */
function sortOpen<T extends { id: number; dueDate: Date | null }>(
  actions: T[],
): T[] {
  return [...actions].sort((a, b) => {
    if (!a.dueDate) return b.dueDate ? 1 : a.id - b.id;
    if (!b.dueDate) return -1;
    return a.dueDate.getTime() - b.dueDate.getTime() || a.id - b.id;
  });
}

/** Action ouverte la plus urgente. */
function nextAction(
  actions: { id: number; label: string; dueDate: Date | null }[],
) {
  const first = sortOpen(actions)[0];
  return first
    ? { id: first.id, label: first.label, dueDate: day(first.dueDate) }
    : null;
}

function contactDates(interactions: { date: Date }[]) {
  const times = interactions.map((i) => i.date.getTime());
  if (!times.length) return { firstContactAt: null, lastContactAt: null };
  return {
    firstContactAt: formatDay(new Date(Math.min(...times))),
    lastContactAt: formatDay(new Date(Math.max(...times))),
  };
}

@Injectable()
export class OpportunitiesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListOpportunitiesQuery) {
    const where: Prisma.OpportunityWhereInput = {};
    const stageFilters: Prisma.OpportunityWhereInput[] = [];
    if (query.stages?.length)
      stageFilters.push({ stage: { in: query.stages } });
    if (query.active) stageFilters.push({ stage: { notIn: CLOSED_STAGES } });
    if (stageFilters.length) where.AND = stageFilters;
    if (query.q) {
      const contains = query.q;
      where.OR = [
        { reference: { contains } },
        { title: { contains } },
        { location: { contains } },
        { company: { name: { contains } } },
        { intermediary: { name: { contains } } },
        { contact: { name: { contains } } },
        { tags: { some: { name: { contains } } } },
      ];
    }

    const [rows, companyCounts] = await Promise.all([
      this.prisma.opportunity.findMany({
        where,
        include: listInclude,
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.opportunity.groupBy({
        by: ['companyId'],
        where: { companyId: { not: null } },
        _count: { _all: true },
      }),
    ]);
    const duplicated = new Set(
      companyCounts.filter((c) => c._count._all > 1).map((c) => c.companyId),
    );

    return rows.map((o) => ({
      id: o.id,
      reference: o.reference,
      title: o.title,
      stage: o.stage,
      platform: o.platform,
      contractType: o.contractType,
      location: o.location,
      remoteDays: o.remoteDays,
      salaryMin: o.salaryMin,
      salaryMax: o.salaryMax,
      tjmMin: o.tjmMin,
      tjmMax: o.tjmMax,
      company: o.company,
      intermediary: o.intermediary,
      intermediaryType: o.intermediaryType,
      contact: o.contact,
      tags: o.tags.map((t) => t.name),
      ...contactDates(o.interactions),
      nextAction: nextAction(o.actions),
      openActions: o.actions.length,
      duplicateCompany: o.companyId !== null && duplicated.has(o.companyId),
      updatedAt: o.updatedAt,
    }));
  }

  async get(id: number) {
    const o = await this.prisma.opportunity.findUnique({
      where: { id },
      include: {
        company: companyRef,
        intermediary: companyRef,
        contact: contactRef,
        tags: { select: { name: true }, orderBy: { name: 'asc' } },
        interactions: { orderBy: [{ date: 'desc' }, { id: 'desc' }] },
        actions: { orderBy: { id: 'asc' } },
      },
    });
    if (!o) throw new NotFoundException(`Piste ${id} introuvable`);

    // Même entreprise proposée sur plusieurs pistes (ex. par deux intermédiaires).
    const duplicateCompany =
      o.companyId !== null &&
      (await this.prisma.opportunity.count({
        where: { companyId: o.companyId },
      })) > 1;

    const openActions = o.actions.filter((a) => !a.doneAt);
    return {
      ...o,
      tags: o.tags.map((t) => t.name),
      ...contactDates(o.interactions),
      nextAction: nextAction(openActions),
      duplicateCompany,
      interactions: o.interactions.map((i) => ({
        id: i.id,
        date: formatDay(i.date),
        channel: i.channel,
        summary: i.summary,
      })),
      // Ouvertes d'abord (par échéance, sans date en dernier), puis faites.
      actions: [
        ...sortOpen(openActions),
        ...o.actions.filter((a) => a.doneAt),
      ].map((a) => ({
        id: a.id,
        label: a.label,
        dueDate: day(a.dueDate),
        doneAt: a.doneAt,
      })),
    };
  }

  async create(dto: CreateOpportunityDto) {
    if (!dto.companyName && !dto.intermediaryName) {
      throw new BadRequestException(MISSING_PARTY);
    }
    const { id } = await this.prisma.$transaction(async (tx) => {
      const rel = await this.resolveRelations(tx, dto, null);
      return tx.opportunity.create({
        data: {
          ...this.scalarFields(dto),
          companyId: rel.companyId,
          intermediaryId: rel.intermediaryId,
          contactId: rel.contactId,
          tags: rel.tags && { connectOrCreate: rel.tags },
        },
        select: { id: true },
      });
    });
    return this.get(id);
  }

  async update(id: number, dto: UpdateOpportunityDto) {
    await this.prisma.$transaction(async (tx) => {
      const current = await tx.opportunity.findUnique({
        where: { id },
        select: { companyId: true, intermediaryId: true },
      });
      if (!current) throw new NotFoundException(`Piste ${id} introuvable`);
      const rel = await this.resolveRelations(tx, dto, current);

      const companyId =
        rel.companyId === undefined ? current.companyId : rel.companyId;
      const intermediaryId =
        rel.intermediaryId === undefined
          ? current.intermediaryId
          : rel.intermediaryId;
      if (companyId === null && intermediaryId === null) {
        throw new BadRequestException(MISSING_PARTY);
      }

      await tx.opportunity.update({
        where: { id },
        data: {
          ...this.scalarFields(dto),
          companyId: rel.companyId,
          intermediaryId: rel.intermediaryId,
          // Sans intermédiaire, son type n'a plus de sens.
          ...(intermediaryId === null ? { intermediaryType: null } : {}),
          contactId: rel.contactId,
          tags: rel.tags && { set: [], connectOrCreate: rel.tags },
        },
      });
    });
    return this.get(id);
  }

  async remove(id: number) {
    await this.prisma.opportunity.delete({ where: { id } });
  }

  /** Champs simples ; undefined = inchangé, null = effacé. */
  private scalarFields(dto: UpdateOpportunityDto) {
    return {
      reference: dto.reference,
      title: dto.title,
      platform: dto.platform,
      contractType: dto.contractType,
      location: dto.location,
      remoteDays: dto.remoteDays,
      duration: dto.duration,
      salaryMin: dto.salaryMin,
      salaryMax: dto.salaryMax,
      tjmMin: dto.tjmMin,
      tjmMax: dto.tjmMax,
      stage: dto.stage,
      url: dto.url,
      notes: dto.notes,
      intermediaryType:
        dto.intermediaryName === null ? null : dto.intermediaryType,
    };
  }

  /**
   * Entreprise, intermédiaire, contact et tags, désignés par leur nom.
   * undefined = inchangé, null = retiré.
   */
  private async resolveRelations(
    tx: Prisma.TransactionClient,
    dto: UpdateOpportunityDto,
    current: { companyId: number | null; intermediaryId: number | null } | null,
  ) {
    const companyId = async (name: string | null | undefined) => {
      if (name === undefined || name === null) return name;
      const company = await tx.company.upsert({
        where: { name },
        create: { name },
        update: {},
      });
      return company.id;
    };

    const company = await companyId(dto.companyName);
    const intermediary = await companyId(dto.intermediaryName);

    let contactId: number | null | undefined;
    if (dto.contact === null) {
      contactId = null;
    } else if (dto.contact) {
      // Le contact appartient à l'intermédiaire s'il y en a un, sinon à l'entreprise.
      const finalIntermediary =
        intermediary !== undefined
          ? intermediary
          : (current?.intermediaryId ?? null);
      const finalCompany =
        company !== undefined ? company : (current?.companyId ?? null);
      const owner = finalIntermediary ?? finalCompany;
      const { name, email, phone } = dto.contact;
      const existing = await tx.contact.findFirst({
        where: { name, companyId: owner },
      });
      const contact = existing
        ? await tx.contact.update({
            where: { id: existing.id },
            data: { email, phone },
          })
        : await tx.contact.create({
            data: { name, email, phone, companyId: owner },
          });
      contactId = contact.id;
    }

    const tags = dto.tags
      ? [...new Set(dto.tags.map((t) => t.trim()).filter(Boolean))].map(
          (name) => ({ where: { name }, create: { name } }),
        )
      : undefined;

    return {
      companyId: company,
      intermediaryId: intermediary,
      contactId,
      tags,
    };
  }
}
