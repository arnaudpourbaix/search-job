import { notifications } from '@mantine/notifications'
import {
  MutationCache,
  QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { api } from './api.ts'
import { NOTIFICATION_KEY } from './notifications.ts'
import type {
  Day,
  OpportunityDetail,
  OpportunityInput,
  OpportunitySummary,
  Ref,
  RefLists,
} from './types.ts'

export const queryClient: QueryClient = new QueryClient({
  // Toute modification peut changer les alertes (action faite, échange ajouté…)
  // et les chiffres des campagnes (pistes créées, gagnées…).
  mutationCache: new MutationCache({
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: NOTIFICATION_KEY }),
        queryClient.invalidateQueries({ queryKey: ['campaigns'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
        // Pistes et échanges d'un contact.
        queryClient.invalidateQueries({ queryKey: ['contacts'] }),
      ]),
  }),
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
    mutations: {
      onError: (error) =>
        notifications.show({ color: 'red', title: 'Erreur', message: error.message }),
    },
  },
})

export type OpportunityFilters = {
  q?: string
  stageIds?: number[]
  active?: boolean
  /** Absent = toutes les campagnes. */
  campaignId?: number
}

function filtersToQuery(f: OpportunityFilters): string {
  const params = new URLSearchParams()
  if (f.q) params.set('q', f.q)
  if (f.stageIds?.length) params.set('stageIds', f.stageIds.join(','))
  if (f.active) params.set('active', 'true')
  if (f.campaignId) params.set('campaignId', String(f.campaignId))
  const s = params.toString()
  return s ? `?${s}` : ''
}

export const useOpportunities = (filters: OpportunityFilters, enabled = true) =>
  useQuery({
    queryKey: ['opportunities', filters],
    enabled,
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

export type InteractionInput = {
  date: Day
  channel: string | null
  summary: string
  contactId: number | null
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
      mutationFn: (body: InteractionInput) =>
        api.post<OpportunityDetail>(`/opportunities/${opportunityId}/interactions`, body),
      onSuccess: refresh,
    }),
    updateInteraction: useMutation({
      mutationFn: ({
        id,
        ...body
      }: InteractionInput & { id: number }) => api.patch<void>(`/interactions/${id}`, body),
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
