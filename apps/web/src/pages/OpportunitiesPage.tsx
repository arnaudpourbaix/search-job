import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Center,
  Group,
  Loader,
  MultiSelect,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { useDebouncedValue, useDisclosure, useLocalStorage } from '@mantine/hooks'
import { IconPlus, IconSearch } from '@tabler/icons-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { NextActionCell, StageBadge } from '../components/badges.tsx'
import { InterviewSteps } from '../components/InterviewSteps.tsx'
import { LastContact, OpportunityName } from '../components/OpportunityParts.tsx'
import { ClosedCampaignNotice } from '../components/CampaignSelect.tsx'
import { OpportunityModal } from '../components/OpportunityModal.tsx'
import { formatPay, isClosed, rowBackground } from '../format.ts'
import { useCampaignSelection } from '../campaigns.ts'
import { useOpportunities } from '../queries.ts'
import { useStages } from '../settings.ts'
import type { OpportunitySummary } from '../types.ts'

function OpportunityTable({ items, showCampaign }: { items: OpportunitySummary[]; showCampaign: boolean }) {
  const navigate = useNavigate()
  return (
    <Table.ScrollContainer minWidth={900}>
      <Table highlightOnHover verticalSpacing="sm">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Entreprise</Table.Th>
            <Table.Th>Étape</Table.Th>
            <Table.Th>Poste</Table.Th>
            <Table.Th>Rémunération</Table.Th>
            <Table.Th>Dernier contact</Table.Th>
            <Table.Th>Prochaine action</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {items.map((o) => (
            <Table.Tr
              key={o.id}
              onClick={() => void navigate(`/pistes/${o.id}`)}
              style={{
                cursor: 'pointer',
                background: rowBackground(o),
                opacity: isClosed(o.stage) ? 0.6 : 1,
              }}
            >
              <Table.Td>
                <OpportunityName o={o} link showCampaign={showCampaign} />
              </Table.Td>
              <Table.Td maw={220}>
                <StageBadge stage={o.stage} />
                {o.interviews && (
                  <Box mt={6}>
                    <InterviewSteps progress={o.interviews} />
                  </Box>
                )}
              </Table.Td>
              <Table.Td>
                <Text size="sm">{o.title ?? '—'}</Text>
                <Text size="xs" c="dimmed" lineClamp={1}>
                  {o.tags.join(', ')}
                </Text>
              </Table.Td>
              <Table.Td>
                <Text size="sm">{formatPay(o) ?? '—'}</Text>
                {o.contractType && (
                  <Text size="xs" c="dimmed">
                    {o.contractType}
                  </Text>
                )}
              </Table.Td>
              <Table.Td>
                <LastContact o={o} />
              </Table.Td>
              <Table.Td maw={260}>
                <NextActionCell action={o.nextAction} />
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  )
}

function OpportunityCards({ items, showCampaign }: { items: OpportunitySummary[]; showCampaign: boolean }) {
  return (
    <Stack gap="sm">
      {items.map((o) => (
        <Card
          key={o.id}
          component={Link}
          to={`/pistes/${o.id}`}
          withBorder
          padding="sm"
          style={{ background: rowBackground(o), opacity: isClosed(o.stage) ? 0.6 : 1 }}
        >
          <Group justify="space-between" wrap="nowrap" align="flex-start">
            <OpportunityName o={o} showCampaign={showCampaign} />
            <StageBadge stage={o.stage} />
          </Group>
          {(o.title || formatPay(o)) && (
            <Text size="sm" mt={6}>
              {[o.title, formatPay(o)].filter(Boolean).join(' · ')}
            </Text>
          )}
          {o.interviews && (
            <Box mt={8}>
              <InterviewSteps progress={o.interviews} />
            </Box>
          )}
          <Group justify="space-between" mt={6} wrap="nowrap">
            <NextActionCell action={o.nextAction} />
            <LastContact o={o} />
          </Group>
        </Card>
      ))}
    </Stack>
  )
}

export function OpportunitiesPage() {
  const [search, setSearch] = useState('')
  const [q] = useDebouncedValue(search.trim(), 250)
  // Filtres mémorisés dans le navigateur.
  const { data: allStages = [] } = useStages()
  const [storedStageIds, setStageIds] = useLocalStorage<number[]>({
    key: 'pistes.stageIds',
    defaultValue: [],
  })
  // Ignore les étapes mémorisées qui ont été supprimées depuis.
  const stageIds = storedStageIds.filter((id) => allStages.some((s) => s.id === id))
  // Pas mémorisé : la liste s'ouvre toujours sur les pistes actives.
  const [active, setActive] = useState(true)
  const [creating, { open, close }] = useDisclosure()
  const { selected, isPending: campaignsPending } = useCampaignSelection()
  const { data, isPending, isError, error, isFetching } = useOpportunities(
    { q, stageIds, active, campaignId: selected?.id },
    !campaignsPending,
  )
  const showCampaign = !selected

  return (
    <Stack>
      <Group justify="space-between">
        <Group gap="xs">
          <Title order={2}>Pistes</Title>
          {data && (
            <Badge variant="default" size="lg">
              {data.length}
            </Badge>
          )}
          {isFetching && !isPending && <Loader size="xs" />}
        </Group>
        <Button leftSection={<IconPlus size={18} />} onClick={open}>
          Nouvelle piste
        </Button>
      </Group>

      <ClosedCampaignNotice />

      <Group align="flex-end" gap="sm">
        <TextInput
          placeholder="Rechercher (entreprise, intermédiaire, référence, contact, techno…)"
          leftSection={<IconSearch size={16} />}
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          style={{ flex: '1 1 260px' }}
        />
        <MultiSelect
          placeholder={stageIds.length ? undefined : 'Toutes les étapes'}
          data={allStages.map((s) => ({ value: String(s.id), label: s.label }))}
          value={stageIds.map(String)}
          onChange={(v) => setStageIds(v.map(Number))}
          clearable
          style={{ flex: '1 1 260px' }}
        />
        <Switch
          label="Actives uniquement"
          checked={active}
          onChange={(e) => setActive(e.currentTarget.checked)}
          mb={8}
        />
      </Group>

      {isPending ? (
        <Center p="xl">
          <Loader />
        </Center>
      ) : isError ? (
        <Alert color="red" title="Impossible de charger les pistes">
          {error.message}
        </Alert>
      ) : data.length === 0 ? (
        <Text c="dimmed" ta="center" p="xl">
          Aucune piste ne correspond aux filtres.
        </Text>
      ) : (
        <>
          <Box visibleFrom="md">
            <OpportunityTable items={data} showCampaign={showCampaign} />
          </Box>
          <Box hiddenFrom="md">
            <OpportunityCards items={data} showCampaign={showCampaign} />
          </Box>
        </>
      )}

      <OpportunityModal opened={creating} onClose={close} />
    </Stack>
  )
}
