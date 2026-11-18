import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { NotificationType } from '../generated/prisma/enums.js';
import { addDays, formatDay, today } from '../common/dates.js';
import {
  heldInterviewWhere,
  lastHeldInterviewSelect,
  latestDate,
} from '../common/interviews.js';
import { openStageFilter, stageRef } from '../common/stages.js';
import { PrismaService } from '../prisma/prisma.service.js';

/** Piste active sans échange depuis ce nombre de jours : à relancer. */
export const STALE_DAYS = 14;
/** Horizon des actions « à venir ». */
export const UPCOMING_DAYS = 7;

type Alert = {
  type: NotificationType;
  message: string;
  dedupeKey: string;
  opportunityId: number;
  actionId: number | null;
};

const companyRef = { select: { id: true, name: true } } as const;

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Calcule les alertes du jour à partir des actions et du journal.
   *
   * La clé d'unicité contient l'échéance (ou la date du dernier échange) : une
   * alerte lue reste lue tant que la situation ne change pas, et une nouvelle
   * alerte apparaît si l'échéance est déplacée ou si la piste repasse en retard.
   */
  async compute(now = new Date()): Promise<Alert[]> {
    const day = today(now);
    const horizon = addDays(day, UPCOMING_DAYS);
    const staleBefore = addDays(day, -STALE_DAYS);
    // Pistes non clôturées des campagnes en cours.
    const active = {
      ...openStageFilter,
      campaign: { endDate: null },
    };

    const [actions, opportunities] = await Promise.all([
      this.prisma.action.findMany({
        where: {
          doneAt: null,
          dueDate: { not: null, lte: horizon },
          opportunity: active,
        },
        select: { id: true, label: true, dueDate: true, opportunityId: true },
      }),
      this.prisma.opportunity.findMany({
        where: {
          ...active,
          OR: [
            { interactions: { some: {} } },
            { interviews: { some: heldInterviewWhere } },
          ],
        },
        select: {
          id: true,
          interactions: {
            select: { date: true },
            orderBy: { date: 'desc' },
            take: 1,
          },
          interviews: lastHeldInterviewSelect,
        },
      }),
    ]);

    const alerts: Alert[] = actions.map((a) => {
      const due = a.dueDate!;
      const type =
        due < day
          ? NotificationType.ACTION_OVERDUE
          : due.getTime() === day.getTime()
            ? NotificationType.ACTION_DUE_TODAY
            : NotificationType.ACTION_UPCOMING;
      return {
        type,
        message: a.label,
        dedupeKey: `${type}:${a.id}:${formatDay(due)}`,
        opportunityId: a.opportunityId,
        actionId: a.id,
      };
    });

    for (const o of opportunities) {
      // Dernier contact : échange du journal ou entretien ayant eu lieu.
      const last = latestDate(o.interactions, o.interviews)!;
      if (last >= staleBefore) continue;
      const days = Math.round((day.getTime() - last.getTime()) / 86_400_000);
      alerts.push({
        type: NotificationType.STALE_OPPORTUNITY,
        message: `Aucun échange depuis ${days} jours`,
        dedupeKey: `STALE_OPPORTUNITY:${o.id}:${formatDay(last)}`,
        opportunityId: o.id,
        actionId: null,
      });
    }
    return alerts;
  }

  /**
   * Synchronise la table avec les alertes du jour : crée les nouvelles (en gardant
   * l'état « lu » des existantes) et supprime celles qui ne sont plus d'actualité
   * (action faite ou déplacée, piste clôturée ou relancée).
   */
  async refresh(now = new Date()) {
    const alerts = await this.compute(now);
    const keys = alerts.map((a) => a.dedupeKey);
    // Les messages évoluent (« depuis 15 jours » → « 16 jours »), d'où l'update.
    const stale = alerts.filter(
      (a) => a.type === NotificationType.STALE_OPPORTUNITY,
    );
    await this.prisma.$transaction([
      this.prisma.notification.deleteMany({
        where: { dedupeKey: { notIn: keys } },
      }),
      this.prisma.notification.createMany({
        data: alerts,
        skipDuplicates: true,
      }),
      ...stale.map((a) =>
        this.prisma.notification.update({
          where: { dedupeKey: a.dedupeKey },
          data: { message: a.message },
        }),
      ),
    ]);
  }

  /** Calcul quotidien, en plus du recalcul à chaque consultation. */
  @Cron('0 6 * * *')
  async daily() {
    try {
      await this.refresh();
    } catch (e) {
      this.logger.error('Calcul des notifications impossible', e as Error);
    }
  }

  async list() {
    await this.refresh();
    const items = await this.prisma.notification.findMany({
      include: {
        opportunity: {
          select: {
            id: true,
            reference: true,
            title: true,
            stage: stageRef,
            company: companyRef,
            intermediary: companyRef,
          },
        },
        action: { select: { id: true, label: true, dueDate: true } },
      },
    });
    // Non lues d'abord, puis par urgence : retard, aujourd'hui, à relancer, à venir.
    const rank: Record<NotificationType, number> = {
      ACTION_OVERDUE: 0,
      ACTION_DUE_TODAY: 1,
      STALE_OPPORTUNITY: 2,
      ACTION_UPCOMING: 3,
    };
    const due = (n: (typeof items)[number]) =>
      n.action?.dueDate?.getTime() ?? 0;
    items.sort(
      (a, b) =>
        Number(!!a.readAt) - Number(!!b.readAt) ||
        rank[a.type] - rank[b.type] ||
        due(a) - due(b) ||
        a.id - b.id,
    );
    return {
      unread: items.filter((n) => !n.readAt).length,
      items: items.map((n) => ({
        id: n.id,
        type: n.type,
        message: n.message,
        read: !!n.readAt,
        opportunity: n.opportunity,
        action: n.action && {
          id: n.action.id,
          label: n.action.label,
          dueDate: n.action.dueDate && formatDay(n.action.dueDate),
        },
      })),
    };
  }

  async markRead(id: number, read: boolean) {
    const { count } = await this.prisma.notification.updateMany({
      where: { id },
      data: { readAt: read ? new Date() : null },
    });
    if (!count) throw new NotFoundException(`Notification ${id} introuvable`);
  }

  async markAllRead() {
    await this.prisma.notification.updateMany({
      where: { readAt: null },
      data: { readAt: new Date() },
    });
  }
}
