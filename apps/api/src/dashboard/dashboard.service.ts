import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { InterviewStatus, StageKind } from '../generated/prisma/enums.js';
import { addDays, formatDay, today } from '../common/dates.js';
import {
  STALE_DAYS,
  UPCOMING_DAYS,
} from '../notifications/notifications.service.js';
import { interviewContactsInclude } from '../common/contacts.js';
import {
  heldInterviewWhere,
  lastHeldInterviewSelect,
  latestDate,
} from '../common/interviews.js';
import { openStageFilter, stageRef } from '../common/stages.js';
import { PrismaService } from '../prisma/prisma.service.js';

const companyRef = { select: { id: true, name: true } } as const;
/** Ce qu'il faut pour nommer une piste côté front. */
const opportunityRef = {
  select: {
    id: true,
    reference: true,
    title: true,
    stage: stageRef,
    company: companyRef,
    intermediary: companyRef,
  },
} as const;

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  /** Synthèse d'une campagne (ou de toutes si campaignId est absent). */
  async get(userId: number, campaignId?: number, now = new Date()) {
    const day = today(now);
    const inCampaign: Prisma.OpportunityWhereInput = campaignId
      ? { userId, campaignId }
      : { userId };
    const active: Prisma.OpportunityWhereInput = {
      ...inCampaign,
      ...openStageFilter,
    };

    const [
      stages,
      stageCounts,
      actions,
      activeOpportunities,
      recent,
      lastWeek,
      lastWeekInterviews,
      openRounds,
    ] = await Promise.all([
      this.prisma.pipelineStage.findMany({
        ...stageRef,
        where: { userId },
        orderBy: [{ order: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.opportunity.groupBy({
        by: ['stageId'],
        where: inCampaign,
        _count: { _all: true },
      }),
      // Actions ouvertes des pistes actives, échéance dépassée ou sous 7 jours.
      this.prisma.action.findMany({
        where: {
          doneAt: null,
          dueDate: { lte: addDays(day, UPCOMING_DAYS) },
          opportunity: active,
        },
        orderBy: [{ dueDate: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          label: true,
          dueDate: true,
          opportunity: opportunityRef,
        },
      }),
      this.prisma.opportunity.findMany({
        where: active,
        select: {
          ...opportunityRef.select,
          interactions: {
            select: { date: true },
            orderBy: { date: 'desc' },
            take: 1,
          },
          interviews: lastHeldInterviewSelect,
        },
      }),
      this.prisma.interaction.findMany({
        where: { opportunity: inCampaign },
        orderBy: [{ date: 'desc' }, { id: 'desc' }],
        take: 8,
        select: {
          id: true,
          date: true,
          channel: true,
          summary: true,
          opportunity: opportunityRef,
        },
      }),
      this.prisma.interaction.count({
        where: { opportunity: inCampaign, date: { gt: addDays(day, -7) } },
      }),
      // Les entretiens ayant eu lieu comptent comme des contacts.
      this.prisma.interview.count({
        where: {
          ...heldInterviewWhere,
          opportunity: inCampaign,
          date: { gt: addDays(day, -7), lte: day },
        },
      }),
      // Tours non tranchés des pistes actives : à venir, à planifier, en attente de retour.
      this.prisma.interview.findMany({
        where: {
          status: { in: [InterviewStatus.PLANNED, InterviewStatus.DONE] },
          opportunity: active,
        },
        orderBy: [{ date: 'asc' }, { time: 'asc' }, { order: 'asc' }],
        select: {
          id: true,
          type: true,
          label: true,
          date: true,
          time: true,
          status: true,
          contacts: interviewContactsInclude,
          opportunity: opportunityRef,
        },
      }),
    ]);

    const staleBefore = addDays(day, -STALE_DAYS);
    const stale = activeOpportunities
      .map(({ interactions, interviews, ...o }) => ({
        opportunity: o,
        last: latestDate(interactions, interviews),
      }))
      .filter(
        (s): s is typeof s & { last: Date } => !!s.last && s.last < staleBefore,
      )
      .map(({ opportunity, last }) => ({
        opportunity,
        lastContactAt: formatDay(last),
      }))
      .sort((a, b) => a.lastContactAt.localeCompare(b.lastContactAt));

    // Pistes par étape, dans l'ordre du pipeline.
    const byStage = stages.map((s) => ({
      ...s,
      count: stageCounts.find((c) => c.stageId === s.id)?._count._all ?? 0,
    }));

    const todo = actions.map((a) => ({
      id: a.id,
      label: a.label,
      dueDate: formatDay(a.dueDate!),
      opportunity: a.opportunity,
    }));
    const todayKey = formatDay(day);

    const rounds = openRounds.map((r) => ({
      ...r,
      date: r.date ? formatDay(r.date) : null,
      contacts: r.contacts.map((c) => c.contact),
    }));
    const planned = rounds.filter((r) => r.status === InterviewStatus.PLANNED);
    const interviews = {
      // Les tours planifiés dont la date est passée restent ici : à mettre à jour.
      upcoming: planned.filter((r) => r.date !== null),
      toSchedule: planned.filter((r) => r.date === null),
      awaiting: rounds.filter((r) => r.status === InterviewStatus.DONE),
    };

    return {
      byStage,
      kpis: {
        total: stageCounts.reduce((n, c) => n + c._count._all, 0),
        active: activeOpportunities.length,
        overdue: todo.filter((a) => a.dueDate < todayKey).length,
        dueToday: todo.filter((a) => a.dueDate === todayKey).length,
        stale: stale.length,
        interviews: byStage
          .filter((s) => s.kind === StageKind.ADVANCED)
          .reduce((n, s) => n + s.count, 0),
        contactsLastWeek: lastWeek + lastWeekInterviews,
        upcomingInterviews: interviews.upcoming.filter(
          (r) => r.date! >= todayKey,
        ).length,
      },
      interviews,
      todo,
      stale,
      recent: recent.map((i) => ({ ...i, date: formatDay(i.date) })),
    };
  }
}
