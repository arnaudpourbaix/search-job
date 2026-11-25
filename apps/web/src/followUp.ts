import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from './api.ts'
import { ME_KEY, useMe, type Me } from './auth.ts'
import { DEFAULT_SILENCE_DAYS, DEFAULT_STALE_DAYS, formatDay } from './format.ts'
import { NOTIFICATION_KEY } from './notifications.ts'
import type { Day, NoResponseReason, OpportunityDetail } from './types.ts'

/** Délai de relance de l'utilisateur connecté. */
export const useStaleDays = () => useMe().data?.staleDays ?? DEFAULT_STALE_DAYS

/** Durées proposées pour reporter une relance. */
export const SNOOZE_CHOICES = [
  { days: 3, label: '3 jours' },
  { days: 7, label: '1 semaine' },
  { days: 14, label: '2 semaines' },
  { days: 30, label: '1 mois' },
] as const

/** Délais de réponse annoncés le plus souvent par les recruteurs. */
export const RESPONSE_CHOICES = [
  { days: 14, label: '2 sem.' },
  { days: 21, label: '3 sem.' },
  { days: 28, label: '4 sem.' },
  { days: 42, label: '6 sem.' },
] as const

/**
 * Modifie la date de relance prévue ou le délai de réponse d'une piste
 * (null : relance de nouveau calculée, ou délai retiré).
 */
export function useFollowUpDates() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      ...dates
    }: {
      id: number
      followUpAt?: Day | null
      responseDueAt?: Day | null
    }) => api.patch<OpportunityDetail>(`/opportunities/${id}`, dates),
    onSuccess: (detail) => {
      qc.setQueryData(['opportunity', detail.id], detail)
      void qc.invalidateQueries({ queryKey: ['opportunities'] })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
      void qc.invalidateQueries({ queryKey: NOTIFICATION_KEY })
    },
  })
}

/** Délai de silence (jours sans réponse malgré des relances) de l'utilisateur connecté. */
export const useSilenceDays = () => useMe().data?.silenceDays ?? DEFAULT_SILENCE_DAYS

/** Modifie les délais de relance et de silence. */
export function useUpdateFollowUpSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (settings: { staleDays?: number; silenceDays?: number }) =>
      api.patch<void>('/settings/preferences', settings),
    onSuccess: (_, settings) => {
      qc.setQueryData<Me | null>(ME_KEY, (me) => me && { ...me, ...settings })
      void qc.invalidateQueries({ queryKey: ['opportunities'] })
      void qc.invalidateQueries({ queryKey: ['opportunity'] })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

/** Pourquoi la piste est « sans réponse », en une phrase. */
export const noResponseText = (reason: NoResponseReason, date: Day) =>
  reason === 'DEADLINE'
    ? `Sans réponse au ${formatDay(date)}, fin du délai annoncé`
    : `Aucune réponse depuis le ${formatDay(date)}, malgré les relances`
