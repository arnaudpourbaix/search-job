import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import {
  assertContacts,
  contactRef,
  interviewContactsInclude,
  opportunityContactsInclude,
} from '../common/contacts.js';
import { formatDay, parseDay } from '../common/dates.js';
import {
  assertCampaign,
  assertStage,
  companyIdByName,
} from '../common/ownership.js';
import {
  formatRound,
  interviewProgress,
  isHeld,
  interviewSummarySelect,
} from '../common/interviews.js';
import {
  recordStageChange,
  stageChangesInclude,
} from '../common/stage-history.js';
import { openStageFilter, stageRef } from '../common/stages.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  CreateOpportunityDto,
  ListOpportunitiesQuery,
  UpdateOpportunityDto,
} from './dto.js';

const MISSING_PARTY = "Renseigner au moins l'entreprise ou l'intermédiaire.";

const companyRef = { select: { id: true, name: true } } as const;
const campaignRef = {
  select: { id: true, name: true, endDate: true },
} as const;

const listInclude = {
  stage: stageRef,
  company: companyRef,
  intermediary: companyRef,
  contacts: opportunityContactsInclude,
  campaign: campaignRef,
  tags: { select: { name: true }, orderBy: { name: 'asc' } },
  interactions: { select: { date: true } },
  actions: {
    where: { doneAt: null },
    select: { id: true, label: true, dueDate: true },
  },
  interviews: interviewSummarySelect,
} satisfies Prisma.OpportunityInclude;

const day = (d: Date | null) => (d ? formatDay(d) : null);

/** Date de fin au format jour (AAAA-MM-JJ), comme partout ailleurs. */
const formatCampaign = (c: {
  id: number;
  name: string;
  endDate: Date | null;
}) => ({
  ...c,
  endDate: day(c.endDate),
});

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

/** Premier et dernier contact : échanges du journal et tours ayant eu lieu. */
function contactDates(
  interactions: { date: Date }[],
  interviews: Parameters<typeof isHeld>[0][],
) {
  const times = [
    ...interactions.map((i) => i.date),
    ...interviews.filter(isHeld).map((r) => r.date),
  ].map((d) => d.getTime());
  if (!times.length) return { firstContactAt: null, lastContactAt: null };
  return {
    firstContactAt: formatDay(new Date(Math.min(...times))),
    lastContactAt: formatDay(new Date(Math.max(...times))),
  };
}

@Injectable()
export class OpportunitiesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: number, query: ListOpportunitiesQuery) {
    const where: Prisma.OpportunityWhereInput = { userId };
    if (query.campaignId) where.campaignId = query.campaignId;
    const stageFilters: Prisma.OpportunityWhereInput[] = [];
    if (query.stageIds?.length)
      stageFilters.push({ stageId: { in: query.stageIds } });
    if (query.active) stageFilters.push(openStageFilter);
    if (stageFilters.length) where.AND = stageFilters;
    if (query.q) {
      // Recherche insensible à la casse (Postgres est sensible par défaut).
      const contains = { contains: query.q, mode: 'insensitive' as const };
      where.OR = [
        { reference: contains },
        { title: contains },
        { location: contains },
        { company: { name: contains } },
        { intermediary: { name: contains } },
        { contacts: { some: { contact: { name: contains } } } },
        { tags: { some: { name: contains } } },
      ];
    }

    const [rows, companyCounts] = await Promise.all([
      this.prisma.opportunity.findMany({
        where,
        include: listInclude,
        orderBy: { updatedAt: 'desc' },
      }),
      // Doublons cherchés au sein d'une même campagne.
      this.prisma.opportunity.groupBy({
        by: ['campaignId', 'companyId'],
        where: { userId, companyId: { not: null } },
        _count: { _all: true },
      }),
    ]);
    const duplicated = new Set(
      companyCounts
        .filter((c) => c._count._all > 1)
        .map((c) => `${c.campaignId}:${c.companyId}`),
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
      contacts: o.contacts.map((c) => c.contact),
      tags: o.tags.map((t) => t.name),
      ...contactDates(o.interactions, o.interviews),
      nextAction: nextAction(o.actions),
      openActions: o.actions.length,
      interviews: interviewProgress(o.interviews),
      campaign: formatCampaign(o.campaign),
      duplicateCompany:
        o.companyId !== null &&
        duplicated.has(`${o.campaignId}:${o.companyId}`),
      snoozedUntil: day(o.snoozedUntil),
      updatedAt: o.updatedAt,
    }));
  }

  async get(userId: number, id: number) {
    const o = await this.prisma.opportunity.findFirst({
      where: { id, userId },
      include: {
        company: companyRef,
        intermediary: companyRef,
        contacts: opportunityContactsInclude,
        campaign: campaignRef,
        stage: stageRef,
        tags: { select: { name: true }, orderBy: { name: 'asc' } },
        interactions: {
          orderBy: [{ date: 'desc' }, { id: 'desc' }],
          include: { contact: contactRef },
        },
        actions: { orderBy: { id: 'asc' } },
        interviews: {
          orderBy: [{ order: 'asc' }, { id: 'asc' }],
          include: { contacts: interviewContactsInclude },
        },
        stageChanges: stageChangesInclude,
      },
    });
    if (!o) throw new NotFoundException(`Piste ${id} introuvable`);

    // Même entreprise proposée sur plusieurs pistes (ex. par deux intermédiaires).
    const duplicateCompany =
      o.companyId !== null &&
      (await this.prisma.opportunity.count({
        where: { userId, companyId: o.companyId, campaignId: o.campaignId },
      })) > 1;

    const openActions = o.actions.filter((a) => !a.doneAt);
    return {
      ...o,
      contacts: o.contacts.map((c) => c.contact),
      campaign: formatCampaign(o.campaign),
      tags: o.tags.map((t) => t.name),
      ...contactDates(o.interactions, o.interviews),
      snoozedUntil: day(o.snoozedUntil),
      nextAction: nextAction(openActions),
      duplicateCompany,
      interviewProgress: interviewProgress(o.interviews),
      interviews: o.interviews.map((r) =>
        formatRound({
          id: r.id,
          type: r.type,
          label: r.label,
          date: r.date,
          time: r.time,
          status: r.status,
          notes: r.notes,
          contacts: r.contacts.map((c) => c.contact),
        }),
      ),
      stageChanges: o.stageChanges.map((c) => ({
        id: c.id,
        fromLabel: c.fromLabel,
        toLabel: c.toLabel,
        auto: c.auto,
        at: c.createdAt,
      })),
      interactions: o.interactions.map((i) => ({
        id: i.id,
        date: formatDay(i.date),
        channel: i.channel,
        summary: i.summary,
        contact: i.contact,
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

  async create(userId: number, dto: CreateOpportunityDto) {
    if (!dto.companyName && !dto.intermediaryName) {
      throw new BadRequestException(MISSING_PARTY);
    }
    const campaignId = dto.campaignId ?? (await this.currentCampaignId(userId));
    const stageId = dto.stageId ?? (await this.firstStageId(userId));
    const { id } = await this.prisma.$transaction(async (tx) => {
      await assertCampaign(tx, userId, campaignId);
      await assertStage(tx, userId, stageId);
      const rel = await this.resolveRelations(tx, userId, dto);
      const created = await tx.opportunity.create({
        data: {
          ...this.scalarFields(dto),
          userId,
          campaignId,
          stageId,
          companyId: rel.companyId,
          intermediaryId: rel.intermediaryId,
          contacts: rel.contactIds && {
            create: rel.contactIds.map((contactId) => ({ contactId })),
          },
          tags: rel.tags && { connectOrCreate: rel.tags },
        },
        select: { id: true },
      });
      await recordStageChange(tx, created.id, null, stageId);
      return created;
    });
    return this.get(userId, id);
  }

  async update(userId: number, id: number, dto: UpdateOpportunityDto) {
    await this.prisma.$transaction(async (tx) => {
      const current = await tx.opportunity.findFirst({
        where: { id, userId },
        select: { companyId: true, intermediaryId: true, stageId: true },
      });
      if (!current) throw new NotFoundException(`Piste ${id} introuvable`);
      if (dto.campaignId) await assertCampaign(tx, userId, dto.campaignId);
      if (dto.stageId) await assertStage(tx, userId, dto.stageId);
      const rel = await this.resolveRelations(tx, userId, dto);

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
          // Liste complète : les contacts déjà présents gardent leur ordre.
          contacts: rel.contactIds && {
            deleteMany: { contactId: { notIn: rel.contactIds } },
            createMany: {
              data: rel.contactIds.map((contactId) => ({ contactId })),
              skipDuplicates: true,
            },
          },
          tags: rel.tags && { set: [], connectOrCreate: rel.tags },
        },
      });
      if (dto.stageId) {
        await recordStageChange(tx, id, current.stageId, dto.stageId);
      }
    });
    return this.get(userId, id);
  }

  /** Première étape du pipeline : étape par défaut d'une nouvelle piste. */
  private async firstStageId(userId: number): Promise<number> {
    const stage = await this.prisma.pipelineStage.findFirst({
      where: { userId },
      orderBy: [{ order: 'asc' }, { id: 'asc' }],
      select: { id: true },
    });
    if (!stage) {
      throw new BadRequestException(
        'Aucune étape définie : en créer une dans les paramètres.',
      );
    }
    return stage.id;
  }

  /** Campagne en cours la plus récente : destination par défaut d'une nouvelle piste. */
  private async currentCampaignId(userId: number): Promise<number> {
    const campaign = await this.prisma.campaign.findFirst({
      where: { userId, endDate: null },
      orderBy: [{ startDate: 'desc' }, { id: 'desc' }],
      select: { id: true },
    });
    if (!campaign) {
      throw new BadRequestException(
        "Aucune campagne en cours : créer d'abord une campagne.",
      );
    }
    return campaign.id;
  }

  /** Reporte la relance jusqu'à un jour donné (null : annule le report). */
  async snooze(userId: number, id: number, until: string | null) {
    const { count } = await this.prisma.opportunity.updateMany({
      where: { id, userId },
      data: { snoozedUntil: until ? parseDay(until) : null },
    });
    if (!count) throw new NotFoundException(`Piste ${id} introuvable`);
  }

  async remove(userId: number, id: number) {
    const { count } = await this.prisma.opportunity.deleteMany({
      where: { id, userId },
    });
    if (!count) throw new NotFoundException(`Piste ${id} introuvable`);
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
      stageId: dto.stageId,
      campaignId: dto.campaignId,
      url: dto.url,
      notes: dto.notes,
      intermediaryType:
        dto.intermediaryName === null ? null : dto.intermediaryType,
    };
  }

  /**
   * Entreprise, intermédiaire et tags désignés par leur nom ; contacts du carnet.
   * undefined = inchangé, null = retiré.
   */
  private async resolveRelations(
    tx: Prisma.TransactionClient,
    userId: number,
    dto: UpdateOpportunityDto,
  ) {
    const company = await companyIdByName(tx, userId, dto.companyName);
    const intermediary = await companyIdByName(
      tx,
      userId,
      dto.intermediaryName,
    );

    const contactIds =
      dto.contactIds && (await assertContacts(tx, userId, dto.contactIds));

    const tags = dto.tags
      ? [...new Set(dto.tags.map((t) => t.trim()).filter(Boolean))].map(
          (name) => ({
            where: { userId_name: { userId, name } },
            create: { userId, name },
          }),
        )
      : undefined;

    return {
      companyId: company,
      intermediaryId: intermediary,
      contactIds,
      tags,
    };
  }
}
