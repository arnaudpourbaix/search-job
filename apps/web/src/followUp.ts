import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from './api.ts'
import { ME_KEY, useMe, type Me } from './auth.ts'
import { DEFAULT_STALE_DAYS } from './format.ts'
import type { Day } from './types.ts'

/** Délai de relance de l'utilisateur connecté. */
export const useStaleDays = () => useMe().data?.staleDays ?? DEFAULT_STALE_DAYS

/** Durées proposées pour reporter une relance. */
export const SNOOZE_CHOICES = [
  { days: 3, label: '3 jours' },
  { days: 7, label: '1 semaine' },
  { days: 14, label: '2 semaines' },
  { days: 30, label: '1 mois' },
] as const

/** Reporte la relance d'une piste jusqu'à un jour donné (null : annule le report). */
export function useSnooze() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, until }: { id: number; until: Day | null }) =>
      api.put<void>(`/opportunities/${id}/snooze`, { until }),
    onSuccess: (_, { id }) => {
      void qc.invalidateQueries({ queryKey: ['opportunity', id] })
      void qc.invalidateQueries({ queryKey: ['opportunities'] })
    },
  })
}

/** Modifie le délai de relance. */
export function useUpdateStaleDays() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (staleDays: number) => api.patch<void>('/settings/preferences', { staleDays }),
    onSuccess: (_, staleDays) => {
      qc.setQueryData<Me | null>(ME_KEY, (me) => me && { ...me, staleDays })
      void qc.invalidateQueries({ queryKey: ['opportunities'] })
    },
  })
}
