import { Anchor, Group, Tooltip } from '@mantine/core'
import { IconMapPin, IconTrain } from '@tabler/icons-react'
import { mapsSearchUrl, transitUrl, useHomeAddress } from '../maps.ts'

/**
 * Lieu ou adresse : ouvre Google Maps, avec un lien d'itinéraire en transports en
 * commun depuis l'adresse de départ des paramètres.
 */
export function PlaceLink({ place, size = 'sm' }: { place: string; size?: 'xs' | 'sm' }) {
  const home = useHomeAddress()
  const iconSize = size === 'xs' ? 12 : 14
  return (
    <Group gap="xs" wrap="wrap" component="span" style={{ display: 'inline-flex' }}>
      <Anchor
        href={mapsSearchUrl(place)}
        target="_blank"
        rel="noreferrer"
        size={size}
        title="Voir sur Google Maps"
      >
        <IconMapPin size={iconSize} style={{ verticalAlign: -2 }} /> {place}
      </Anchor>
      <Tooltip
        label={
          home
            ? `En transports en commun depuis ${home}`
            : 'En transports en commun depuis ta position (adresse de départ réglable dans les paramètres)'
        }
        multiline
        maw={280}
        withArrow
      >
        <Anchor
          href={transitUrl(place, home)}
          target="_blank"
          rel="noreferrer"
          size={size}
          c="dimmed"
          style={{ whiteSpace: 'nowrap' }}
        >
          <IconTrain size={iconSize} style={{ verticalAlign: -2 }} /> Itinéraire
        </Anchor>
      </Tooltip>
    </Group>
  )
}
