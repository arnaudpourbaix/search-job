import {
  Alert,
  Anchor,
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
import {
  DuplicateCompanyIcon,
  NextActionCell,
  StageBadge,
  StaleIcon,
} from '../components/badges.tsx'
import { OpportunityModal } from '../components/OpportunityModal.tsx'
import {
  dueStatus,
  formatDay,
  formatPay,
  isClosed,
  isStale,
  opportunityName,
  opportunitySubtitle,
  STAGE_LABELS,
} from '../format.ts'
import { useOpportunities } from '../queries.ts'
import { STAGES, type OpportunitySummary, type Stage } from '../types.ts'

/** Fond de ligne selon l'urgence (mêmes règles que l'ancien fichier Excel). */
function rowBackground(o: OpportunitySummary): string | undefined {
  if (isClosed(o.stage)) return 'var(--mantine-color-default-hover)'
  const status = dueStatus(o.nextAction?.dueDate)
  if (status === 'overdue') return 'var(--mantine-color-red-light)'
  if (status === 'today') return 'var(--mantine-color-orange-light)'
  return undefined
}

/** Entreprise (ou « Entreprise inconnue ») + « via intermédiaire · référence ». */
function Name({ o, link }: { o: OpportunitySummary; link?: boolean }) {
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
    </Box>
  )
}

function LastContact({ o }: { o: OpportunitySummary }) {
  const stale = isStale(o)
  return (
    <Group gap={4} wrap="nowrap">
      <Text size="sm" c={stale ? 'red' : undefined} fs={stale ? 'italic' : undefined}>
        {formatDay(o.lastContactAt)}
      </Text>
      {stale && <StaleIcon />}
    </Group>
  )
}

function OpportunityTable({ items }: { items: OpportunitySummary[] }) {
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
                <Name o={o} link />
              </Table.Td>
              <Table.Td>
                <StageBadge stage={o.stage} />
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

function OpportunityCards({ items }: { items: OpportunitySummary[] }) {
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
            <Name o={o} />
            <StageBadge stage={o.stage} />
          </Group>
          {(o.title || formatPay(o)) && (
            <Text size="sm" mt={6}>
              {[o.title, formatPay(o)].filter(Boolean).join(' · ')}
            </Text>
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
  const [stages, setStages] = useLocalStorage<Stage[]>({
    key: 'pistes.stages',
    defaultValue: [],
  })
  const [active, setActive] = useLocalStorage<boolean>({
    key: 'pistes.active',
    defaultValue: true,
  })
  const [creating, { open, close }] = useDisclosure()
  const { data, isPending, isError, error, isFetching } = useOpportunities({
    q,
    stages,
    active,
  })

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

      <Group align="flex-end" gap="sm">
        <TextInput
          placeholder="Rechercher (entreprise, intermédiaire, référence, contact, techno…)"
          leftSection={<IconSearch size={16} />}
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          style={{ flex: '1 1 260px' }}
        />
        <MultiSelect
          placeholder={stages.length ? undefined : 'Toutes les étapes'}
          data={STAGES.map((s) => ({ value: s, label: STAGE_LABELS[s] }))}
          value={stages}
          onChange={(v) => setStages(v as Stage[])}
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
            <OpportunityTable items={data} />
          </Box>
          <Box hiddenFrom="md">
            <OpportunityCards items={data} />
          </Box>
        </>
      )}

      <OpportunityModal opened={creating} onClose={close} />
    </Stack>
  )
}
