import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { NotificationType } from '../generated/prisma/enums.js';
import { addDays, formatDay, frenchDay, today } from '../common/dates.js';
import {
  heldInterviewWhere,
  lastHeldInterviewSelect,
  latestDate,
  upcomingInterviewWhere,
} from '../common/interviews.js';
import {
  contactsOf,
  followUp,
  followUpFields,
  followUpSettingsSelect,
} from '../common/follow-up.js';
import { openStageFilter, stageRef } from '../common/stages.js';
import { PrismaService } from '../prisma/prisma.service.js';

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
  async compute(userId?: number, now = new Date()): Promise<Alert[]> {
    const day = today(now);
    const horizon = addDays(day, UPCOMING_DAYS);
    // Pistes non clôturées des campagnes en cours (d'un utilisateur, ou de tous).
    const active = {
      ...(userId === undefined ? {} : { userId }),
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
            { followUpAt: { not: null } },
            { responseDueAt: { not: null } },
          ],
        },
        select: {
          id: true,
          ...followUpFields,
          // Délai de relance propre à chaque utilisateur.
          user: { select: followUpSettingsSelect },
          interactions: { select: { date: true, answered: true } },
          interviews: lastHeldInterviewSelect,
          _count: {
            select: { interviews: { where: upcomingInterviewWhere(day) } },
          },
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
      const contacts = contactsOf(o.interactions, o.interviews);
      const last = latestDate(contacts);
      const f = followUp(
        {
          ...o,
          closed: false,
          contacts,
          upcomingInterview: o._count.interviews > 0,
        },
        day,
        o.user,
      );
      if (f.status === 'NO_RESPONSE') {
        alerts.push({
          type: NotificationType.NO_RESPONSE,
          message:
            f.reason === 'DEADLINE'
              ? `Sans réponse au ${frenchDay(f.date!)}, fin du délai annoncé : à clôturer ?`
              : `Aucune réponse depuis le ${frenchDay(f.date!)} malgré les relances : à clôturer ?`,
          dedupeKey: `NO_RESPONSE:${o.id}:${f.reason}:${formatDay(f.date!)}`,
          opportunityId: o.id,
          actionId: null,
        });
        continue;
      }
      if (f.status !== 'DUE') continue;
      // Relance prévue à une date précise, ou délai écoulé depuis le dernier contact.
      if (f.planned) {
        alerts.push({
          type: NotificationType.STALE_OPPORTUNITY,
          message: `Relance prévue le ${frenchDay(f.date!)}`,
          dedupeKey: `STALE_OPPORTUNITY:${o.id}:prevue:${formatDay(f.date!)}`,
          opportunityId: o.id,
          actionId: null,
        });
        continue;
      }
      const days = Math.round((day.getTime() - last!.getTime()) / 86_400_000);
      alerts.push({
        type: NotificationType.STALE_OPPORTUNITY,
        message: `Aucun échange depuis ${days} jours`,
        dedupeKey: `STALE_OPPORTUNITY:${o.id}:${formatDay(last!)}`,
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
  async refresh(userId?: number, now = new Date()) {
    const alerts = await this.compute(userId, now);
    const keys = alerts.map((a) => a.dedupeKey);
    // Les messages évoluent (« depuis 15 jours » → « 16 jours »), d'où l'update.
    const stale = alerts.filter(
      (a) => a.type === NotificationType.STALE_OPPORTUNITY,
    );
    await this.prisma.$transaction([
      this.prisma.notification.deleteMany({
        where: {
          dedupeKey: { notIn: keys },
          ...(userId === undefined ? {} : { opportunity: { userId } }),
        },
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

  async list(userId: number) {
    await this.refresh(userId);
    const items = await this.prisma.notification.findMany({
      where: { opportunity: { userId } },
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
      NO_RESPONSE: 3,
      ACTION_UPCOMING: 4,
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

  async markRead(userId: number, id: number, read: boolean) {
    const { count } = await this.prisma.notification.updateMany({
      where: { id, opportunity: { userId } },
      data: { readAt: read ? new Date() : null },
    });
    if (!count) throw new NotFoundException(`Notification ${id} introuvable`);
  }

  async markAllRead(userId: number) {
    await this.prisma.notification.updateMany({
      where: { readAt: null, opportunity: { userId } },
      data: { readAt: new Date() },
    });
  }
}
