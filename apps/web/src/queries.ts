import { notifications } from '@mantine/notifications'
import {
  QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { api } from './api.ts'
import type {
  Day,
  OpportunityDetail,
  OpportunityInput,
  OpportunitySummary,
  Ref,
  RefLists,
  Stage,
} from './types.ts'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
    mutations: {
      onError: (error) =>
        notifications.show({ color: 'red', title: 'Erreur', message: error.message }),
    },
  },
})

export type OpportunityFilters = { q?: string; stages?: Stage[]; active?: boolean }

function filtersToQuery(f: OpportunityFilters): string {
  const params = new URLSearchParams()
  if (f.q) params.set('q', f.q)
  if (f.stages?.length) params.set('stages', f.stages.join(','))
  if (f.active) params.set('active', 'true')
  const s = params.toString()
  return s ? `?${s}` : ''
}

export const useOpportunities = (filters: OpportunityFilters) =>
  useQuery({
    queryKey: ['opportunities', filters],
    queryFn: () => api.get<OpportunitySummary[]>(`/opportunities${filtersToQuery(filters)}`),
    placeholderData: (previous) => previous,
  })

export const useOpportunity = (id: number) =>
  useQuery({
    queryKey: ['opportunity', id],
    queryFn: () => api.get<OpportunityDetail>(`/opportunities/${id}`),
  })

export const useRefLists = () =>
  useQuery({ queryKey: ['ref-lists'], queryFn: () => api.get<RefLists>('/ref-lists') })

export const useCompanies = () =>
  useQuery({ queryKey: ['companies'], queryFn: () => api.get<Ref[]>('/companies') })

export const useTags = () =>
  useQuery({ queryKey: ['tags'], queryFn: () => api.get<string[]>('/tags') })

/** Après une modification : rafraîchit listes, fiche et données de référence. */
function useRefresh() {
  const qc = useQueryClient()
  return (detail?: OpportunityDetail) => {
    if (detail) qc.setQueryData(['opportunity', detail.id], detail)
    void qc.invalidateQueries({ queryKey: ['opportunities'] })
    void qc.invalidateQueries({ queryKey: ['companies'] })
    void qc.invalidateQueries({ queryKey: ['tags'] })
  }
}

export function useCreateOpportunity() {
  const refresh = useRefresh()
  return useMutation({
    mutationFn: (input: OpportunityInput) =>
      api.post<OpportunityDetail>('/opportunities', input),
    onSuccess: refresh,
  })
}

export function useUpdateOpportunity(id: number) {
  const refresh = useRefresh()
  return useMutation({
    mutationFn: (input: Partial<OpportunityInput>) =>
      api.patch<OpportunityDetail>(`/opportunities/${id}`, input),
    onSuccess: refresh,
  })
}

export function useDeleteOpportunity() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.delete(`/opportunities/${id}`),
    onSuccess: (_, id) => {
      qc.removeQueries({ queryKey: ['opportunity', id] })
      void qc.invalidateQueries({ queryKey: ['opportunities'] })
    },
  })
}

/** Échanges et actions : la fiche est rechargée après chaque modification. */
export function useJournal(opportunityId: number) {
  const qc = useQueryClient()
  const refresh = useRefresh()
  const reload = async () => {
    await qc.invalidateQueries({ queryKey: ['opportunity', opportunityId] })
    void qc.invalidateQueries({ queryKey: ['opportunities'] })
  }

  return {
    addInteraction: useMutation({
      mutationFn: (body: { date: Day; channel: string | null; summary: string }) =>
        api.post<OpportunityDetail>(`/opportunities/${opportunityId}/interactions`, body),
      onSuccess: refresh,
    }),
    updateInteraction: useMutation({
      mutationFn: ({
        id,
        ...body
      }: {
        id: number
        date: Day
        channel: string | null
        summary: string
      }) => api.patch<void>(`/interactions/${id}`, body),
      onSuccess: reload,
    }),
    removeInteraction: useMutation({
      mutationFn: (id: number) => api.delete(`/interactions/${id}`),
      onSuccess: reload,
    }),
    addAction: useMutation({
      mutationFn: (body: { label: string; dueDate: Day | null }) =>
        api.post<OpportunityDetail>(`/opportunities/${opportunityId}/actions`, body),
      onSuccess: refresh,
    }),
    updateAction: useMutation({
      mutationFn: ({ id, ...body }: { id: number; done?: boolean; dueDate?: Day | null }) =>
        api.patch<void>(`/actions/${id}`, body),
      onSuccess: reload,
    }),
    removeAction: useMutation({
      mutationFn: (id: number) => api.delete(`/actions/${id}`),
      onSuccess: reload,
    }),
  }
}
