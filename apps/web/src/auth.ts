import { useQuery } from '@tanstack/react-query'
import { api, isUnauthorized } from './api.ts'
import { queryClient } from './queries.ts'

/** Utilisateur connecté (compte Google). */
export type Me = {
  id: number
  email: string
  name: string | null
  picture: string | null
  /** Délai de relance : jours sans contact avant qu'une piste soit « à relancer ». */
  staleDays: number
}

export const ME_KEY = ['me'] as const

/** Utilisateur connecté, ou null sans session (page de connexion). */
export const useMe = () =>
  useQuery({
    queryKey: ME_KEY,
    queryFn: async () => {
      try {
        return await api.get<Me>('/auth/me')
      } catch (error) {
        if (isUnauthorized(error)) return null
        throw error
      }
    },
    staleTime: Infinity,
    retry: false,
  })

/** Oublie tout ce qui a été chargé : les données d'un compte ne restent pas affichées. */
export function signedOut() {
  // La requête « me » reste (l'application l'observe) : elle passe à null, ce qui
  // affiche la page de connexion. Tout le reste est effacé.
  queryClient.setQueryData(ME_KEY, null)
  queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== ME_KEY[0] })
  queryClient.getMutationCache().clear()
}

/** Déconnexion : la session est supprimée côté serveur. */
export async function logout() {
  try {
    await api.post('/auth/logout', {})
  } finally {
    signedOut()
  }
}
