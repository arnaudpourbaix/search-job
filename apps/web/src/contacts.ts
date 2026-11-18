import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './api.ts'
import type { Contact, ContactInput, ContactRef } from './types.ts'

/** Carnet complet (quelques centaines de contacts au plus : filtrage côté client). */
export const useContacts = () =>
  useQuery({
    queryKey: ['contacts'],
    queryFn: () => api.get<Contact[]>('/contacts'),
  })

/** « Recruteur · Cabinet X » */
export const contactDetails = (c: Pick<ContactRef, 'title' | 'company'>) =>
  [c.title, c.company?.name].filter(Boolean).join(' · ')

/** Texte de recherche d'un contact (nom, fonction, société, coordonnées). */
export const contactSearchText = (c: ContactRef) =>
  // Le numéro aussi sans espaces : « 0189 » trouve « 01 89 53 69 77 ».
  [c.name, c.title, c.company?.name, c.email, c.phone, c.phone?.replace(/\D/g, '')]
    .filter(Boolean)
    .join(' ')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()

export const normalizeSearch = (q: string) =>
  q
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()

export function useContactMutations() {
  const qc = useQueryClient()
  // Un contact modifié s'affiche sur les fiches et les listes de pistes.
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['contacts'] })
    void qc.invalidateQueries({ queryKey: ['opportunity'] })
    void qc.invalidateQueries({ queryKey: ['opportunities'] })
    void qc.invalidateQueries({ queryKey: ['companies'] })
  }
  return {
    create: useMutation({
      mutationFn: (body: ContactInput) => api.post<Contact>('/contacts', body),
      onSuccess: refresh,
    }),
    update: useMutation({
      mutationFn: ({ id, ...body }: Partial<ContactInput> & { id: number }) =>
        api.patch<Contact>(`/contacts/${id}`, body),
      onSuccess: refresh,
    }),
    remove: useMutation({
      mutationFn: (id: number) => api.delete(`/contacts/${id}`),
      onSuccess: refresh,
    }),
  }
}
