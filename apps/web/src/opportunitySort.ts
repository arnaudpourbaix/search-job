import type { OpportunitySummary } from './types.ts'

/** Colonnes triables de la liste des pistes. */
export type SortColumn = 'pay' | 'lastContact'
export type Sort = { column: SortColumn; direction: 'asc' | 'desc' }

/** Tri par défaut : les pistes contactées le plus récemment d'abord. */
export const DEFAULT_SORT: Sort = { column: 'lastContact', direction: 'desc' }

/** Montant retenu d'une fourchette : le haut, ou la seule borne saisie. */
const amount = (min: number | null, max: number | null) => max ?? min

/**
 * Clé de tri de la rémunération. Un salaire annuel et un TJM ne se comparent pas :
 * les salaires d'abord, puis les TJM, chacun trié par montant ; sans rémunération, en
 * dernier quel que soit le sens.
 */
function payKey(o: OpportunitySummary): [group: number, value: number] | null {
  const salary = amount(o.salaryMin, o.salaryMax)
  if (salary !== null) return [0, salary]
  const tjm = amount(o.tjmMin, o.tjmMax)
  if (tjm !== null) return [1, tjm]
  return null
}

/** Pistes triées selon la colonne choisie. */
export function sortOpportunities(items: OpportunitySummary[], sort: Sort): OpportunitySummary[] {
  const sign = sort.direction === 'asc' ? 1 : -1
  const compare =
    sort.column === 'pay'
      ? (a: OpportunitySummary, b: OpportunitySummary) => {
          const ka = payKey(a)
          const kb = payKey(b)
          if (!ka || !kb) return ka ? -1 : kb ? 1 : 0
          return ka[0] - kb[0] || sign * (ka[1] - kb[1])
        }
      : (a: OpportunitySummary, b: OpportunitySummary) => {
          const da = a.lastContactAt
          const db = b.lastContactAt
          if (!da || !db) return da ? -1 : db ? 1 : 0
          return sign * da.localeCompare(db)
        }
  // Tri stable : à égalité, l'ordre de l'API (dernière modification) est gardé.
  return [...items].sort(compare)
}

/** Clic sur un en-tête : une autre colonne se trie en décroissant, la même change de sens. */
export function nextSort(sort: Sort, column: SortColumn): Sort {
  if (sort.column !== column) return { column, direction: 'desc' }
  return { column, direction: sort.direction === 'desc' ? 'asc' : 'desc' }
}
