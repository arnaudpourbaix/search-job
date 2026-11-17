import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './api.ts'

export type ListCategory = 'PLATFORM' | 'CONTRACT_TYPE' | 'INTERMEDIARY_TYPE' | 'CHANNEL'

export type ListItem = { id: number; value: string; order: number; usage: number }

export type EditableList = {
  category: ListCategory
  items: ListItem[]
  /** Valeurs utilisées dans les pistes / échanges mais absentes de la liste. */
  unlisted: { value: string; usage: number }[]
}

export const LIST_INFO: Record<
  ListCategory,
  { title: string; description: string; usedIn: string }
> = {
  PLATFORM: {
    title: 'Plateformes',
    description: "Où l'offre a été trouvée (LinkedIn, Malt…).",
    usedIn: 'piste',
  },
  CONTRACT_TYPE: {
    title: 'Types de contrat',
    description: 'Freelance, CDI, portage…',
    usedIn: 'piste',
  },
  INTERMEDIARY_TYPE: {
    title: "Types d'intermédiaire",
    description: "Apporteur d'affaires, société de portage, cabinet de recrutement…",
    usedIn: 'piste',
  },
  CHANNEL: {
    title: "Canaux d'échange",
    description: 'Moyens de contact utilisés dans le journal.',
    usedIn: 'échange',
  },
}

export const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? 's' : ''}`

export const useEditableLists = () =>
  useQuery({
    queryKey: ['settings', 'lists'],
    queryFn: () => api.get<EditableList[]>('/settings/lists'),
  })

/** Mutations des listes : rafraîchit le paramétrage, les listes des formulaires et les pistes. */
export function useListMutations() {
  const qc = useQueryClient()
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['settings', 'lists'] })
    void qc.invalidateQueries({ queryKey: ['ref-lists'] })
    void qc.invalidateQueries({ queryKey: ['opportunities'] })
    void qc.invalidateQueries({ queryKey: ['opportunity'] })
  }

  return {
    add: useMutation({
      mutationFn: ({ category, value }: { category: ListCategory; value: string }) =>
        api.post<ListItem>(`/settings/lists/${category}`, { value }),
      onSuccess: refresh,
    }),
    rename: useMutation({
      mutationFn: ({ id, value }: { id: number; value: string }) =>
        api.patch<{ updated: number }>(`/settings/lists/items/${id}`, { value }),
      onSuccess: refresh,
    }),
    reorder: useMutation({
      mutationFn: ({ category, ids }: { category: ListCategory; ids: number[] }) =>
        api.put(`/settings/lists/${category}/order`, { ids }),
      // Affichage immédiat du nouvel ordre, sans attendre le serveur.
      onMutate: ({ category, ids }) => {
        qc.setQueryData<EditableList[]>(['settings', 'lists'], (lists) =>
          lists?.map((l) =>
            l.category !== category
              ? l
              : {
                  ...l,
                  items: ids
                    .map((id) => l.items.find((i) => i.id === id))
                    .filter((i): i is ListItem => !!i),
                },
          ),
        )
      },
      onSettled: refresh,
    }),
    remove: useMutation({
      mutationFn: ({ id, replaceWith }: { id: number; replaceWith?: string | null }) =>
        api.delete<{ updated: number }>(
          `/settings/lists/items/${id}` +
            (replaceWith ? `?replaceWith=${encodeURIComponent(replaceWith)}` : ''),
        ),
      onSuccess: refresh,
    }),
  }
}
