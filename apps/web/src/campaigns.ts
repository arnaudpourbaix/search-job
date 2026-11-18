import { useLocalStorage } from '@mantine/hooks'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './api.ts'
import type { Day } from './types.ts'

export type Campaign = {
  id: number
  name: string
  goal: string | null
  startDate: Day
  /** Date de clôture ; null = en cours. */
  endDate: Day | null
  total: number
  active: number
  won: number
}

export type CampaignInput = {
  name: string
  goal: string | null
  startDate: Day
  endDate?: Day | null
  closeOthers?: boolean
}

/** Valeur spéciale du sélecteur : toutes les campagnes. */
export const ALL_CAMPAIGNS = 'all'

export const useCampaigns = () =>
  useQuery({ queryKey: ['campaigns'], queryFn: () => api.get<Campaign[]>('/campaigns') })

/**
 * Campagne affichée dans les Pistes et le Pipeline, mémorisée dans le navigateur.
 * Par défaut (ou si la campagne mémorisée a été supprimée) : la campagne en cours.
 */
export function useCampaignSelection() {
  const { data: campaigns = [], isPending } = useCampaigns()
  const [stored, setStored] = useLocalStorage<string>({ key: 'campaign', defaultValue: '' })

  const current = campaigns.find((c) => !c.endDate) ?? campaigns[0] ?? null
  const all = stored === ALL_CAMPAIGNS
  const selected = all ? null : (campaigns.find((c) => String(c.id) === stored) ?? current)

  return {
    campaigns,
    isPending,
    /** Campagne en cours la plus récente (destination par défaut des nouvelles pistes). */
    current,
    /** null = toutes les campagnes. */
    selected,
    value: all ? ALL_CAMPAIGNS : selected ? String(selected.id) : null,
    select: (value: string) => setStored(value),
  }
}

export function useCampaignMutations() {
  const qc = useQueryClient()
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['campaigns'] })
    void qc.invalidateQueries({ queryKey: ['opportunities'] })
    void qc.invalidateQueries({ queryKey: ['opportunity'] })
  }
  return {
    create: useMutation({
      mutationFn: (input: CampaignInput) => api.post<Campaign>('/campaigns', input),
      onSuccess: refresh,
    }),
    update: useMutation({
      mutationFn: ({ id, ...input }: Partial<CampaignInput> & { id: number }) =>
        api.patch<Campaign>(`/campaigns/${id}`, input),
      onSuccess: refresh,
    }),
    remove: useMutation({
      mutationFn: (id: number) => api.delete(`/campaigns/${id}`),
      onSuccess: refresh,
    }),
  }
}
