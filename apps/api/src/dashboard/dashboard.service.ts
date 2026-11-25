import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { InterviewStatus, StageKind } from '../generated/prisma/enums.js';
import { addDays, formatDay, today } from '../common/dates.js';
import { UPCOMING_DAYS } from '../notifications/notifications.service.js';
import {
  contactsOf,
  followUp,
  followUpFields,
  followUpSettingsSelect,
} from '../common/follow-up.js';
import { interviewContactsInclude } from '../common/contacts.js';
import {
  heldInterviewWhere,
  lastHeldInterviewSelect,
  latestDate,
  upcomingInterviewWhere,
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
      user,
      stages,
      stageCounts,
      actions,
      activeOpportunities,
      recent,
      lastWeek,
      lastWeekInterviews,
      openRounds,
    ] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: followUpSettingsSelect,
      }),
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
          ...followUpFields,
          // Tous les échanges : réponses et relances sans réponse comptent différemment.
          interactions: { select: { date: true, answered: true } },
          interviews: lastHeldInterviewSelect,
          _count: {
            select: { interviews: { where: upcomingInterviewWhere(day) } },
          },
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

    // Relance de chaque piste active.
    const followUps = activeOpportunities.map(
      ({
        interactions,
        interviews,
        _count,
        followUpAt,
        followUpSetOn,
        responseDueAt,
        responseDueSetOn,
        ...o
      }) => {
        const contacts = contactsOf(interactions, interviews);
        const last = latestDate(contacts);
        const f = followUp(
          {
            closed: false,
            contacts,
            upcomingInterview: _count.interviews > 0,
            followUpAt,
            followUpSetOn,
            responseDueAt,
            responseDueSetOn,
          },
          day,
          user,
        );
        return {
          opportunity: o,
          lastContactAt: last && formatDay(last),
          status: f.status,
          date: f.date && formatDay(f.date),
          planned: f.planned,
          reason: f.reason,
        };
      },
    );
    // À relancer, la relance la plus ancienne d'abord.
    const stale = followUps
      .filter((f) => f.status === 'DUE')
      .map(({ opportunity, lastContactAt, date, planned }) => ({
        opportunity,
        lastContactAt,
        followUpAt: date!,
        planned,
      }))
      .sort((a, b) => a.followUpAt.localeCompare(b.followUpAt));
    // Sans réponse (délai annoncé dépassé, ou long silence) : clôture proposée.
    const noResponse = followUps
      .filter((f) => f.status === 'NO_RESPONSE')
      .map(({ opportunity, lastContactAt, date, reason }) => ({
        opportunity,
        lastContactAt,
        reason: reason!,
        date: date!,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

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
      staleDays: user.staleDays,
      byStage,
      kpis: {
        total: stageCounts.reduce((n, c) => n + c._count._all, 0),
        active: activeOpportunities.length,
        overdue: todo.filter((a) => a.dueDate < todayKey).length,
        dueToday: todo.filter((a) => a.dueDate === todayKey).length,
        stale: stale.length,
        noResponse: noResponse.length,
        interviews: byStage
          .filter((s) => s.kind === StageKind.ADVANCED)
          .reduce((n, s) => n + s.count, 0),
        contactsLastWeek: lastWeek + lastWeekInterviews,
        upcomingInterviews: interviews.upcoming.filter(
          (r) => r.date! >= todayKey,
        ).length,
        // Tous les tours non tranchés : ceux du bloc « Entretiens ».
        openInterviews: rounds.length,
      },
      interviews,
      todo,
      stale,
      noResponse,
      recent: recent.map((i) => ({ ...i, date: formatDay(i.date) })),
    };
  }
}
