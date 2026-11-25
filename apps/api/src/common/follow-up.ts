import { addDays } from './dates.js';

/** Délai de relance par défaut : jours sans contact avant qu'une piste soit « à relancer ». */
export const DEFAULT_STALE_DAYS = 14;
/** Bornes du délai réglable dans les paramètres. */
export const MIN_STALE_DAYS = 1;
export const MAX_STALE_DAYS = 90;

/** Silence par défaut : jours sans réponse, malgré des relances, avant de proposer la clôture. */
export const DEFAULT_SILENCE_DAYS = 30;
export const MIN_SILENCE_DAYS = 7;
export const MAX_SILENCE_DAYS = 180;

/** Réglages de relance d'un utilisateur. */
export type FollowUpSettings = { staleDays: number; silenceDays: number };

/** Ce qu'il faut charger de l'utilisateur pour le calcul. */
export const followUpSettingsSelect = {
  staleDays: true,
  silenceDays: true,
} as const;

/**
 * Où en est la relance d'une piste :
 * - NONE : rien à suivre (piste close, ou jamais contactée sans date prévue) ;
 * - INTERVIEW : un entretien est prévu, la suite est calée ;
 * - AWAITING : on attend une réponse jusqu'à la date annoncée (pas de relance d'ici là) ;
 * - NO_RESPONSE : délai de réponse dépassé, ou long silence malgré des relances :
 *   clôture proposée ;
 * - PLANNED : relance prévue à une date future ;
 * - DUE : à relancer (date de relance atteinte).
 */
export type FollowUpStatus =
  'NONE' | 'INTERVIEW' | 'AWAITING' | 'NO_RESPONSE' | 'PLANNED' | 'DUE';

/** Pourquoi une piste est « sans réponse ». */
export type NoResponseReason = 'DEADLINE' | 'SILENCE';

/**
 * Contact d'une piste : échange du journal, ou entretien ayant eu lieu (toujours
 * « répondu »). Un échange sans réponse (message laissé, mail resté sans retour)
 * est une relance faite, pas une réponse.
 */
export type Contact = { date: Date; answered: boolean };

/** Données d'une piste utiles au calcul de sa relance. */
export type FollowUpInput = {
  closed: boolean;
  contacts: Contact[];
  /** Un entretien est prévu aujourd'hui ou plus tard. */
  upcomingInterview: boolean;
  followUpAt: Date | null;
  followUpSetOn: Date | null;
  responseDueAt: Date | null;
  responseDueSetOn: Date | null;
};

export type FollowUpResult = {
  status: FollowUpStatus;
  /**
   * DUE / PLANNED : date de relance ; AWAITING : réponse attendue d'ici là ;
   * NO_RESPONSE : fin du délai annoncé (DEADLINE) ou date de la dernière réponse
   * (SILENCE).
   */
  date: Date | null;
  /** La date de relance a été saisie sur la piste (sinon : calculée). */
  planned: boolean;
  reason: NoResponseReason | null;
};

/** Champs d'une piste à charger pour le calcul. */
export const followUpFields = {
  followUpAt: true,
  followUpSetOn: true,
  responseDueAt: true,
  responseDueSetOn: true,
} as const;

const latest = (dates: Date[]) =>
  dates.reduce<Date | null>((a, d) => (!a || d > a ? d : a), null);

/** Premier contact, dernier contact et dernière réponse. */
export function contactDates(contacts: Contact[]) {
  const dates = contacts.map((c) => c.date);
  return {
    first: dates.reduce<Date | null>((a, d) => (!a || d < a ? d : a), null),
    last: latest(dates),
    lastReply: latest(contacts.filter((c) => c.answered).map((c) => c.date)),
  };
}

/**
 * Date saisie sur la piste, tant qu'aucun contact n'a eu lieu après sa saisie
 * (`since` : le dernier contact qui compte pour cette date).
 */
export function stillValid(
  date: Date | null,
  setOn: Date | null,
  since: Date | null,
): Date | null {
  if (!date) return null;
  return !since || !setOn || since <= setOn ? date : null;
}

/** Dates saisies encore valables : une relance faite consomme la date de relance,
 * seule une réponse annule le délai de réponse. */
export function validDates(o: FollowUpInput) {
  const { last, lastReply } = contactDates(o.contacts);
  return {
    followUpAt: stillValid(o.followUpAt, o.followUpSetOn, last),
    responseDueAt: stillValid(o.responseDueAt, o.responseDueSetOn, lastReply),
  };
}

const result = (
  status: FollowUpStatus,
  date: Date | null = null,
  extra: Partial<FollowUpResult> = {},
): FollowUpResult => ({ status, date, planned: false, reason: null, ...extra });

/**
 * Relance d'une piste au jour `day`. Sans date saisie, la relance tombe au dernier
 * contact (réponse ou relance) + `staleDays` jours.
 */
export function followUp(
  o: FollowUpInput,
  day: Date,
  { staleDays, silenceDays }: FollowUpSettings,
): FollowUpResult {
  if (o.closed) return result('NONE');
  if (o.upcomingInterview) return result('INTERVIEW');
  const { first, last, lastReply } = contactDates(o.contacts);
  const { followUpAt: planned, responseDueAt: responseDue } = validDates(o);

  if (responseDue) {
    if (responseDue <= day)
      return result('NO_RESPONSE', responseDue, { reason: 'DEADLINE' });
    // Une relance prévue avant l'échéance reste valable.
    if (!planned || planned >= responseDue)
      return result('AWAITING', responseDue);
  }
  // Relance repoussée volontairement : on attend jusque-là.
  if (planned && planned > day)
    return result('PLANNED', planned, { planned: true });

  // Long silence : aucune réponse depuis `silenceDays` jours malgré au moins une relance.
  const since = lastReply ?? first;
  if (
    since &&
    addDays(since, silenceDays) <= day &&
    o.contacts.some((c) => !c.answered && c.date > since)
  )
    return result('NO_RESPONSE', since, { reason: 'SILENCE' });

  const date = planned ?? (last && addDays(last, staleDays));
  if (!date) return result('NONE');
  return result(date <= day ? 'DUE' : 'PLANNED', date, {
    planned: planned !== null,
  });
}

/** Contacts d'une piste : ses échanges et ses entretiens ayant eu lieu (déjà filtrés). */
export const contactsOf = (
  interactions: Contact[],
  heldInterviews: { date: Date | null }[],
): Contact[] => [
  ...interactions,
  ...heldInterviews.flatMap((r) =>
    r.date ? [{ date: r.date, answered: true }] : [],
  ),
];
