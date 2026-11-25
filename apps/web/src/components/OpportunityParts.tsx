import { Anchor, Box, Group, Text } from '@mantine/core'
import { IconFlag } from '@tabler/icons-react'
import { Link } from 'react-router'
import { formatDay, isStale, opportunityName, opportunitySubtitle } from '../format.ts'
import type { OpportunitySummary } from '../types.ts'
import { DuplicateCompanyIcon, StaleIcon } from './badges.tsx'

/** Entreprise (ou « Entreprise inconnue ») + « via intermédiaire · référence ». */
export function OpportunityName({
  o,
  link,
  showCampaign,
}: {
  o: OpportunitySummary
  link?: boolean
  /** Affiche la campagne (vue « toutes les campagnes »). */
  showCampaign?: boolean
}) {
  const subtitle = opportunitySubtitle(o)
  const name = (
    <Text fw={500} fs={o.company ? undefined : 'italic'} lineClamp={1} span>
      {opportunityName(o)}
    </Text>
  )
  return (
    <Box miw={0}>
      <Group gap={4} wrap="nowrap">
        {link ? (
          <Anchor component={Link} to={`/pistes/${o.id}`} onClick={(e) => e.stopPropagation()}>
            {name}
          </Anchor>
        ) : (
          name
        )}
        {o.duplicateCompany && <DuplicateCompanyIcon />}
      </Group>
      {subtitle && (
        <Text size="sm" c="dimmed" lineClamp={1}>
          {subtitle}
        </Text>
      )}
      {showCampaign && (
        <Text size="xs" c="dimmed" lineClamp={1}>
          <IconFlag size={11} style={{ verticalAlign: -1 }} /> {o.campaign.name}
        </Text>
      )}
    </Box>
  )
}

export function LastContact({ o }: { o: OpportunitySummary }) {
  const stale = isStale(o)
  return (
    <Group gap={4} wrap="nowrap">
      <Text size="sm" c={stale ? 'red' : undefined} fs={stale ? 'italic' : undefined}>
        {formatDay(o.lastContactAt)}
      </Text>
      {stale && <StaleIcon since={o.followUp.date} />}
    </Group>
  )
}
