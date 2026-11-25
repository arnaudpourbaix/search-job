import type { Day, OpportunitySummary, Stage, StageKind } from './types.ts'

/** Natures d'étape qui clôturent une piste. */
export const CLOSED_KINDS: StageKind[] = ['WON', 'LOST']

export const isClosed = (stage: Pick<Stage, 'kind'>) => CLOSED_KINDS.includes(stage.kind)

/** Délai de relance par défaut (réglable dans les paramètres). */
export const DEFAULT_STALE_DAYS = 14
/** Silence par défaut : jours sans réponse, malgré des relances, avant de proposer la clôture. */
export const DEFAULT_SILENCE_DAYS = 30

/** Date du jour (locale) au format YYYY-MM-DD. */
export function today(): Day {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function addDays(day: Day, days: number): Day {
  const d = new Date(`${day}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** 2026-11-16 → 16/11/2026 */
export function formatDay(day: Day | null | undefined): string {
  if (!day) return '—'
  const [y, m, d] = day.split('-')
  return `${d}/${m}/${y}`
}

export type DueStatus = 'overdue' | 'today' | 'soon' | 'later' | 'none'

/** Urgence d'une échéance (« soon » = dans les 7 jours). */
export function dueStatus(dueDate: Day | null | undefined): DueStatus {
  if (!dueDate) return 'none'
  const t = today()
  if (dueDate < t) return 'overdue'
  if (dueDate === t) return 'today'
  if (dueDate <= addDays(t, 7)) return 'soon'
  return 'later'
}

export const DUE_COLORS: Record<DueStatus, string> = {
  overdue: 'red',
  today: 'orange',
  soon: 'yellow',
  later: 'gray',
  none: 'gray',
}

/** Piste à relancer (règle calculée par l'API). */
export const isStale = (o: Pick<OpportunitySummary, 'followUp'>) => o.followUp.status === 'DUE'

/** Jour local (YYYY-MM-DD) d'un horodatage ISO. */
export function localDay(iso: string): Day {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Nombre de jours entre deux dates. */
export const daysBetween = (from: Day, to: Day) =>
  Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000)

/** Durée lisible : « 1 jour », « 12 jours », « 1 mois », « 2 mois », « 1 an et 3 mois ». */
export function formatAge(days: number): string {
  if (days < 1) return "aujourd'hui"
  if (days < 30) return days === 1 ? '1 jour' : `${days} jours`
  const months = (d: number) => Math.min(11, Math.floor(d / 30))
  if (days < 365) return `${months(days)} mois`
  const years = Math.floor(days / 365)
  const rest = months(days % 365)
  const y = years === 1 ? '1 an' : `${years} ans`
  return rest ? `${y} et ${rest} mois` : y
}

/**
 * Début d'une piste : son premier contact ou sa création, le plus ancien des deux
 * (les pistes reprises de l'Excel ont été créées après leurs premiers échanges).
 */
export function opportunityStart(o: { firstContactAt: Day | null; createdAt: string }): Day {
  const created = localDay(o.createdAt)
  return o.firstContactAt && o.firstContactAt < created ? o.firstContactAt : created
}

const euro = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
})

function range(min: number | null, max: number | null, suffix: string): string | null {
  if (min === null && max === null) return null
  if (min === null || max === null || min === max) {
    return `${euro.format((min ?? max)!)}${suffix}`
  }
  return `${euro.format(min)} – ${euro.format(max)}${suffix}`
}

/** Rémunération lisible : TJM et/ou salaire annuel. */
export function formatPay(
  o: Pick<OpportunitySummary, 'tjmMin' | 'tjmMax' | 'salaryMin' | 'salaryMax'>,
): string | null {
  const parts = [range(o.tjmMin, o.tjmMax, ' /j'), range(o.salaryMin, o.salaryMax, ' /an')].filter(
    Boolean,
  )
  return parts.length ? parts.join(' · ') : null
}

type Named = Pick<OpportunitySummary, 'company' | 'intermediary' | 'reference'>

/** Nom affiché d'une piste : l'entreprise, ou « Entreprise inconnue ». */
export function opportunityName(o: Named): string {
  return o.company?.name ?? 'Entreprise inconnue'
}

/** Ligne secondaire : « via Tachyan · BPCE_INFO01289 ». */
export function opportunitySubtitle(o: Named): string | null {
  const parts = [o.intermediary ? `via ${o.intermediary.name}` : null, o.reference]
  return parts.filter(Boolean).join(' · ') || null
}

/** Fond selon l'urgence (mêmes règles que l'ancien fichier Excel). */
export function rowBackground(o: OpportunitySummary): string | undefined {
  if (isClosed(o.stage)) return 'var(--mantine-color-default-hover)'
  const status = dueStatus(o.nextAction?.dueDate)
  if (status === 'overdue') return 'var(--mantine-color-red-light)'
  if (status === 'today') return 'var(--mantine-color-orange-light)'
  return undefined
}

/**
 * Numéro de téléphone mis en forme : « 01 89 53 69 77 », « +33 6 12 34 56 78 ».
 * Un numéro qui ne ressemble pas à un numéro français est laissé tel quel.
 */
export function formatPhone(phone: string): string {
  const raw = phone.trim()
  const digits = raw.replace(/[\s.\-()/]/g, '')
  const pairs = (s: string) => s.match(/\d{2}/g)!.join(' ')
  if (/^0\d{9}$/.test(digits)) return pairs(digits)
  const intl = /^(?:\+|00)33(\d{9})$/.exec(digits)
  if (intl) return `+33 ${intl[1][0]} ${pairs(intl[1].slice(1))}`
  return raw
}

/** Lien « tel: » d'un numéro (sans espaces ni séparateurs). */
export const phoneHref = (phone: string) => `tel:${phone.replace(/[\s.\-()/]/g, '')}`
