import type { Prisma } from '../generated/prisma/client.js';
import { InterviewStatus } from '../generated/prisma/enums.js';
import { formatDay } from './dates.js';

type Round = {
  type: string;
  label: string | null;
  date: Date | null;
  time: string | null;
  status: InterviewStatus;
};

/** Champs d'un tour à charger pour le résumé (dans l'ordre du processus). */
export const interviewSummarySelect = {
  select: { type: true, label: true, date: true, time: true, status: true },
  orderBy: [{ order: 'asc' }, { id: 'asc' }],
} satisfies Prisma.Opportunity$interviewsArgs;

/**
 * Tour qui a eu lieu : daté et plus « à venir » (passé, validé ou non retenu).
 * Il compte comme un contact, au même titre qu'un échange du journal.
 */
export const heldInterviewWhere = {
  status: { not: InterviewStatus.PLANNED },
  date: { not: null },
} satisfies Prisma.InterviewWhereInput;

export const isHeld = (
  r: Pick<Round, 'date' | 'status'>,
): r is Round & { date: Date } =>
  r.status !== InterviewStatus.PLANNED && r.date !== null;

/**
 * Tour à venir : prévu et daté d'aujourd'hui ou plus tard. Tant qu'il y en a un,
 * la piste n'est pas à relancer.
 */
export const upcomingInterviewWhere = (day: Date) =>
  ({
    status: InterviewStatus.PLANNED,
    date: { gte: day },
  }) satisfies Prisma.InterviewWhereInput;

/** Date du prochain tour à venir (null si aucun). */
export function nextInterviewDate(
  rounds: Pick<Round, 'date' | 'status'>[],
  day: Date,
): Date | null {
  let next: Date | null = null;
  for (const { date, status } of rounds)
    if (
      status === InterviewStatus.PLANNED &&
      date &&
      date >= day &&
      (!next || date < next)
    )
      next = date;
  return next;
}

/** Dernier tour ayant eu lieu (pour la date du dernier contact). */
export const lastHeldInterviewSelect = {
  where: heldInterviewWhere,
  select: { date: true },
  orderBy: { date: 'desc' },
  take: 1,
} satisfies Prisma.Opportunity$interviewsArgs;

/** Date la plus récente parmi des échanges et des tours (null si aucune). */
export function latestDate(...lists: { date: Date | null }[][]): Date | null {
  let last: Date | null = null;
  for (const list of lists)
    for (const { date } of list)
      if (date && (!last || date > last)) last = date;
  return last;
}

export const formatRound = <T extends Round>(r: T) => ({
  ...r,
  date: r.date ? formatDay(r.date) : null,
});

/**
 * Où en est le processus de recrutement : statut de chaque tour (pour la frise),
 * nombre de tours validés et tour en cours (le premier qui n'est ni validé ni
 * refusé). null si la piste n'a aucun tour.
 */
export function interviewProgress(rounds: Round[]) {
  if (!rounds.length) return null;
  const current = rounds.find(
    (r) =>
      r.status === InterviewStatus.PLANNED || r.status === InterviewStatus.DONE,
  );
  return {
    total: rounds.length,
    passed: rounds.filter((r) => r.status === InterviewStatus.PASSED).length,
    failed: rounds.some((r) => r.status === InterviewStatus.FAILED),
    steps: rounds.map((r) => r.status),
    current: current ? formatRound(current) : null,
  };
}
