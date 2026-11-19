import {
  ActionIcon,
  Anchor,
  Badge,
  Box,
  Button,
  Card,
  Center,
  Group,
  Loader,
  Menu,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { modals } from '@mantine/modals'
import { IconDots, IconPencil, IconPlus, IconSearch, IconTrash } from '@tabler/icons-react'
import { Link, useSearchParams } from 'react-router'
import { useCompanyMutations } from '../companies.ts'
import { openCompanyModal } from '../companyModal.tsx'
import { PlaceLink } from '../components/PlaceLink.tsx'
import { normalizeSearch } from '../contacts.ts'
import { useCompanies } from '../queries.ts'
import { plural } from '../settings.ts'
import type { Company } from '../types.ts'

/** Lien vers les contacts de l'entreprise (page Contacts filtrée). */
const contactsLink = (c: Company) => `/contacts?entreprise=${c.id}`

function NameCell({ c }: { c: Company }) {
  return (
    <div>
      <Anchor
        component="button"
        type="button"
        fw={600}
        size="sm"
        c="var(--mantine-color-text)"
        ta="left"
        onClick={() => openCompanyModal(c)}
      >
        {c.name}
      </Anchor>
      {c.address && (
        <div>
          <PlaceLink place={c.address} size="xs" />
        </div>
      )}
      {c.notes && (
        <Text size="xs" c="dimmed" lineClamp={2} mt={2} style={{ whiteSpace: 'pre-wrap' }}>
          {c.notes}
        </Text>
      )}
    </div>
  )
}

function Contacts({ c }: { c: Company }) {
  if (!c.contacts.length)
    return (
      <Text size="sm" c="dimmed">
        Aucun contact
      </Text>
    )
  return (
    <Stack gap={2}>
      {c.contacts.map((p) => (
        <Text key={p.id} size="sm" lineClamp={1}>
          {p.name}
          {p.title && (
            <Text span size="sm" c="dimmed">
              {' · '}
              {p.title}
            </Text>
          )}
        </Text>
      ))}
      <Anchor component={Link} to={contactsLink(c)} size="xs">
        {c.contacts.length > 1 ? `Voir les ${c.contacts.length} contacts` : 'Voir le contact'}
      </Anchor>
    </Stack>
  )
}

/**
 * Pistes de l'entreprise. Comme client : « via Intermédiaire » ;
 * comme intermédiaire : « pour Client ».
 */
function Opportunities({ c }: { c: Company }) {
  if (!c.opportunities.length)
    return (
      <Text size="sm" c="dimmed">
        Aucune piste
      </Text>
    )
  return (
    <Group gap={6}>
      {c.opportunities.map((o) => (
        <Badge
          key={`${o.role}-${o.id}`}
          component={Link}
          to={`/pistes/${o.id}`}
          color={o.stage.color}
          variant="light"
          style={{ cursor: 'pointer', textTransform: 'none' }}
          title={`${o.stage.label} · ${o.campaign.name}`}
        >
          {o.role === 'CLIENT'
            ? [o.title, o.intermediary && `via ${o.intermediary.name}`].filter(Boolean).join(' ') ||
              'En direct'
            : `Pour ${o.company?.name ?? 'un client inconnu'}`}
        </Badge>
      ))}
    </Group>
  )
}

function CompanyMenu({ c }: { c: Company }) {
  const { remove } = useCompanyMutations()
  const confirmRemove = () =>
    modals.openConfirmModal({
      title: `Supprimer ${c.name} ?`,
      children: (
        <Text size="sm">
          {c.contacts.length || c.opportunities.length
            ? `${[
                c.contacts.length ? plural(c.contacts.length, 'contact') : null,
                c.opportunities.length ? plural(c.opportunities.length, 'piste') : null,
              ]
                .filter(Boolean)
                .join(' et ')} ${
                c.contacts.length + c.opportunities.length > 1 ? 'sont conservés' : 'est conservé'
              }, sans entreprise.`
            : "Elle n'est utilisée nulle part."}
        </Text>
      ),
      labels: { confirm: 'Supprimer', cancel: 'Annuler' },
      confirmProps: { color: 'red' },
      onConfirm: () => remove.mutate(c.id),
    })
  return (
    <Menu position="bottom-end" withinPortal>
      <Menu.Target>
        <ActionIcon variant="subtle" color="gray" aria-label={`Options de ${c.name}`}>
          <IconDots size={16} />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item leftSection={<IconPencil size={14} />} onClick={() => openCompanyModal(c)}>
          Modifier
        </Menu.Item>
        <Menu.Item color="red" leftSection={<IconTrash size={14} />} onClick={confirmRemove}>
          Supprimer
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  )
}

function CompaniesTable({ companies }: { companies: Company[] }) {
  return (
    <Table verticalSpacing="sm" highlightOnHover>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Entreprise</Table.Th>
          <Table.Th>Contacts</Table.Th>
          <Table.Th>Pistes</Table.Th>
          <Table.Th w={40} />
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {companies.map((c) => (
          <Table.Tr key={c.id}>
            <Table.Td maw={280}>
              <NameCell c={c} />
            </Table.Td>
            <Table.Td maw={280}>
              <Contacts c={c} />
            </Table.Td>
            <Table.Td>
              <Opportunities c={c} />
            </Table.Td>
            <Table.Td>
              <CompanyMenu c={c} />
            </Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  )
}

function CompanyCards({ companies }: { companies: Company[] }) {
  return (
    <Stack gap="sm">
      {companies.map((c) => (
        <Card key={c.id} withBorder padding="sm">
          <Group justify="space-between" wrap="nowrap" align="flex-start">
            <NameCell c={c} />
            <CompanyMenu c={c} />
          </Group>
          <Box mt={8}>
            <Contacts c={c} />
          </Box>
          <Box mt={8}>
            <Opportunities c={c} />
          </Box>
        </Card>
      ))}
    </Stack>
  )
}

/** Entreprises : clients et intermédiaires, avec leurs contacts et leurs pistes. */
export function CompaniesPage() {
  const { data, isPending } = useCompanies()
  const [params, setParams] = useSearchParams()
  const search = params.get('q') ?? ''
  const setSearch = (q: string) => setParams(q ? { q } : {}, { replace: true })

  const q = normalizeSearch(search)
  const companies = (data ?? []).filter(
    (c) => !q || normalizeSearch(`${c.name} ${c.address ?? ''} ${c.notes ?? ''}`).includes(q),
  )

  return (
    <Stack>
      <Group justify="space-between">
        <Group gap="xs">
          <Title order={2}>Entreprises</Title>
          {data && (
            <Badge variant="default" size="lg">
              {data.length}
            </Badge>
          )}
        </Group>
        <Button leftSection={<IconPlus size={18} />} onClick={() => openCompanyModal()}>
          Nouvelle entreprise
        </Button>
      </Group>
      <Text size="sm" c="dimmed" mt={-8}>
        Clients, ESN, cabinets… Elles se créent d'elles-mêmes depuis les pistes et les contacts.
      </Text>

      <TextInput
        placeholder="Rechercher (nom, adresse, notes)"
        leftSection={<IconSearch size={16} />}
        value={search}
        onChange={(e) => setSearch(e.currentTarget.value)}
      />

      {isPending ? (
        <Center py="xl">
          <Loader />
        </Center>
      ) : companies.length === 0 ? (
        <Text c="dimmed" ta="center" py="xl">
          {data?.length ? 'Aucune entreprise ne correspond.' : 'Aucune entreprise pour le moment.'}
        </Text>
      ) : (
        <>
          <Box visibleFrom="md">
            <CompaniesTable companies={companies} />
          </Box>
          <Box hiddenFrom="md">
            <CompanyCards companies={companies} />
          </Box>
        </>
      )}
    </Stack>
  )
}
