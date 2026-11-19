import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from './api.ts'
import { ME_KEY, useMe, type Me } from './auth.ts'

/** Liens Google Maps (format « Maps URLs » : aucune clé d'API nécessaire). */
const MAPS = 'https://www.google.com/maps'

/** Recherche d'un lieu ou d'une adresse sur la carte. */
export const mapsSearchUrl = (place: string) =>
  `${MAPS}/search/?api=1&query=${encodeURIComponent(place)}`

/**
 * Itinéraire en transports en commun (train, métro, bus) vers un lieu. Sans adresse de
 * départ, Google Maps part de la position actuelle ou la demande.
 */
export function transitUrl(destination: string, origin: string | null) {
  const params = new URLSearchParams({ api: '1', destination, travelmode: 'transit' })
  if (origin) params.set('origin', origin)
  return `${MAPS}/dir/?${params.toString()}`
}

/** Adresse de départ des itinéraires (paramètres), ou null. */
export const useHomeAddress = () => useMe().data?.homeAddress ?? null

/** Modifie l'adresse de départ (null : effacée). */
export function useUpdateHomeAddress() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (homeAddress: string | null) =>
      api.patch<void>('/settings/preferences', { homeAddress }),
    onSuccess: (_, homeAddress) =>
      qc.setQueryData<Me | null>(ME_KEY, (me) => me && { ...me, homeAddress }),
  })
}
