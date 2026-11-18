import { Text, type MantineSize } from '@mantine/core'
import type { ContactRef } from '../types.ts'

/**
 * « avec Julie Martin (Chargée de recrutement), Marc Dubois (Manager technique) ».
 * Même affichage partout : processus, journal, historique, tableau de bord.
 * Sans fonction, la société est indiquée à la place.
 */
export function ContactNames({
  contacts,
  size = 'sm',
  lineClamp,
}: {
  contacts: ContactRef[]
  size?: MantineSize
  lineClamp?: number
}) {
  if (!contacts.length) return null
  return (
    <Text size={size} lineClamp={lineClamp}>
      avec{' '}
      {contacts.map((c, i) => {
        const detail = c.title ?? c.company?.name
        return (
          <span key={c.id}>
            {i > 0 && ', '}
            <Text span size={size} fw={500}>
              {c.name}
            </Text>
            {detail && (
              <Text span size={size} c="dimmed">
                {' '}
                ({detail})
              </Text>
            )}
          </span>
        )
      })}
    </Text>
  )
}
