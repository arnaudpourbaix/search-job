import { Alert, Select } from '@mantine/core'
import { IconArchive, IconFlag } from '@tabler/icons-react'
import { ALL_CAMPAIGNS, useCampaignSelection } from '../campaigns.ts'
import { formatDay } from '../format.ts'

/** Choix de la campagne affichée (Pistes, Pipeline). */
export function CampaignSelect() {
  const { campaigns, value, select } = useCampaignSelection()
  if (!campaigns.length) return null
  const option = (c: (typeof campaigns)[number]) => ({ value: String(c.id), label: c.name })

  return (
    <Select
      aria-label="Campagne affichée"
      size="sm"
      w={{ base: 230, sm: 260 }}
      leftSection={<IconFlag size={16} />}
      allowDeselect={false}
      value={value}
      onChange={(v) => v && select(v)}
      data={[
        { group: 'En cours', items: campaigns.filter((c) => !c.endDate).map(option) },
        { group: 'Terminées', items: campaigns.filter((c) => c.endDate).map(option) },
        {
          group: 'Historique',
          items: [{ value: ALL_CAMPAIGNS, label: 'Toutes les campagnes' }],
        },
      ].filter((g) => g.items.length)}
      comboboxProps={{ width: 260, position: 'bottom-end' }}
    />
  )
}

/** Rappel affiché quand on consulte une campagne terminée. */
export function ClosedCampaignNotice() {
  const { selected } = useCampaignSelection()
  if (!selected?.endDate) return null
  return (
    <Alert color="gray" variant="light" icon={<IconArchive size={18} />} py="xs">
      Campagne « {selected.name} » terminée le {formatDay(selected.endDate)} : consultation
      seulement, ses pistes ne génèrent plus de notifications.
    </Alert>
  )
}
