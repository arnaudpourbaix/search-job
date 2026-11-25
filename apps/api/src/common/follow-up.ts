import { addDays } from './dates.js';

/** Délai de relance par défaut : jours sans contact avant qu'une piste soit « à relancer ». */
export const DEFAULT_STALE_DAYS = 14;
/** Bornes du délai réglable dans les paramètres. */
export const MIN_STALE_DAYS = 1;
export const MAX_STALE_DAYS = 90;

/**
 * Piste active à relancer : elle a déjà eu un contact, le dernier date de plus de
 * `staleDays` jours, aucun entretien n'est prévu (la suite est déjà calée) et la
 * relance n'est pas reportée au-delà d'aujourd'hui.
 */
export function needsFollowUp(
  last: Date | null,
  snoozedUntil: Date | null,
  day: Date,
  staleDays: number,
  upcomingInterview: boolean,
): boolean {
  if (!last || last >= addDays(day, -staleDays) || upcomingInterview)
    return false;
  return !snoozedUntil || snoozedUntil <= day;
}
