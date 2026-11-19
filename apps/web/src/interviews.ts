import {
  IconCalendarEvent,
  IconCalendarQuestion,
  IconCheck,
  IconHourglassHigh,
  IconX,
  type Icon,
} from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from './api.ts'
import { addDays, formatDay, today } from './format.ts'
import type { Day, InterviewRound, InterviewStatus, OpportunityDetail } from './types.ts'

type RoundLike = Pick<InterviewRound, 'type' | 'label' | 'date' | 'time' | 'status'>

/** Affichage d'un tour selon son état (le statut « à venir » se dédouble selon la date). */
export type RoundState = 'TO_SCHEDULE' | 'UPCOMING' | 'OUTDATED' | 'DONE' | 'PASSED' | 'FAILED'

export const ROUND_STATE_INFO: Record<RoundState, { label: string; color: string; icon: Icon }> = {
  TO_SCHEDULE: { label: 'À planifier', color: 'gray', icon: IconCalendarQuestion },
  UPCOMING: { label: 'À venir', color: 'blue', icon: IconCalendarEvent },
  OUTDATED: { label: 'Date passée', color: 'orange', icon: IconCalendarEvent },
  DONE: { label: 'En attente du retour', color: 'yellow', icon: IconHourglassHigh },
  PASSED: { label: 'Validé', color: 'green', icon: IconCheck },
  FAILED: { label: 'Non retenu', color: 'red', icon: IconX },
}

/** Libellés des statuts enregistrés (menu de changement de statut). */
export const STATUS_LABELS: Record<InterviewStatus, string> = {
  PLANNED: 'À venir / à planifier',
  DONE: 'Passé, en attente du retour',
  PASSED: 'Validé',
  FAILED: 'Non retenu',
}

export function roundState(r: Pick<RoundLike, 'date' | 'status'>): RoundState {
  if (r.status !== 'PLANNED') return r.status
  if (!r.date) return 'TO_SCHEDULE'
  return r.date < today() ? 'OUTDATED' : 'UPCOMING'
}

/** « Test · anglais » */
export const roundTitle = (r: Pick<RoundLike, 'type' | 'label'>) =>
  r.label ? `${r.type} · ${r.label}` : r.type

/** « aujourd'hui 14:30 », « demain », « 20/11/2026 10:00 » ; null sans date. */
export function roundWhen(r: Pick<RoundLike, 'date' | 'time'>): string | null {
  if (!r.date) return null
  const day =
    r.date === today()
      ? "aujourd'hui"
      : r.date === addDays(today(), 1)
        ? 'demain'
        : formatDay(r.date)
  return r.time ? `${day} ${r.time}` : day
}

export type InterviewInput = {
  type: string
  label: string | null
  date: Day | null
  time: string | null
  status: InterviewStatus
  notes: string | null
  /** Liste complète des interlocuteurs (identifiants du carnet). */
  contactIds: number[]
}

/** Mutations des tours d'une piste. */
export function useInterviews(opportunityId: number) {
  const qc = useQueryClient()
  const reload = async () => {
    await qc.invalidateQueries({ queryKey: ['opportunity', opportunityId] })
    void qc.invalidateQueries({ queryKey: ['opportunities'] })
    void qc.invalidateQueries({ queryKey: ['settings', 'lists'] })
  }
  return {
    add: useMutation({
      mutationFn: (body: InterviewInput) =>
        api.post<OpportunityDetail>(`/opportunities/${opportunityId}/interviews`, body),
      onSuccess: (detail) => {
        // Le premier entretien peut faire avancer la piste d'étape : on le signale.
        const before = qc.getQueryData<OpportunityDetail>(['opportunity', opportunityId])
        if (before && before.stage.id !== detail.stage.id) {
          notifications.show({
            color: detail.stage.color,
            title: 'Étape mise à jour',
            message: `La piste passe à l'étape « ${detail.stage.label} ».`,
          })
        }
        qc.setQueryData(['opportunity', opportunityId], detail)
        void qc.invalidateQueries({ queryKey: ['opportunities'] })
        void qc.invalidateQueries({ queryKey: ['settings', 'lists'] })
      },
    }),
    update: useMutation({
      mutationFn: ({ id, ...body }: Partial<InterviewInput> & { id: number }) =>
        api.patch<void>(`/interviews/${id}`, body),
      // Statut affiché tout de suite (menu rapide).
      // Les interlocuteurs suivent au rechargement de la fiche.
      onMutate: ({ id, contactIds: _contactIds, ...body }) => {
        qc.setQueryData<OpportunityDetail>(
          ['opportunity', opportunityId],
          (o) =>
            o && {
              ...o,
              interviews: o.interviews.map((r) => (r.id === id ? { ...r, ...body } : r)),
            },
        )
      },
      onSettled: reload,
    }),
    remove: useMutation({
      mutationFn: (id: number) => api.delete(`/interviews/${id}`),
      onSuccess: reload,
    }),
    reorder: useMutation({
      mutationFn: (ids: number[]) =>
        api.put(`/opportunities/${opportunityId}/interviews/order`, { ids }),
      onMutate: (ids) => {
        qc.setQueryData<OpportunityDetail>(
          ['opportunity', opportunityId],
          (o) =>
            o && {
              ...o,
              interviews: ids
                .map((id) => o.interviews.find((r) => r.id === id))
                .filter((r): r is InterviewRound => !!r),
            },
        )
      },
      onSettled: reload,
    }),
  }
}
