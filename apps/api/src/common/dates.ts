/**
 * Convention : les dates « jour » (contacts, échéances) sont stockées à minuit UTC
 * et échangées avec le front au format « YYYY-MM-DD ».
 */
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function parseDay(value: string): Date {
  if (!DAY.test(value)) throw new Error(`Date invalide : ${value}`);
  return new Date(`${value}T00:00:00.000Z`);
}

export function formatDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Date du jour (fuseau local du serveur) à minuit UTC. */
export function today(now = new Date()): Date {
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

/** Jour au format français (JJ/MM/AAAA), pour les messages. */
export function frenchDay(date: Date): string {
  return formatDay(date).split('-').reverse().join('/');
}
