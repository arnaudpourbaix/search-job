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
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { modals } from '@mantine/modals'
import {
  IconBrandLinkedin,
  IconBuildingSkyscraper,
  IconDots,
  IconMail,
  IconPencil,
  IconPhone,
  IconPlus,
  IconSearch,
  IconTrash,
} from '@tabler/icons-react'
import { Link, useSearchParams } from 'react-router'
import { openContactModal } from '../contactModal.tsx'
import {
  contactDetails,
  contactSearchText,
  normalizeSearch,
  useContactMutations,
  useContacts,
} from '../contacts.ts'
import { formatDay, formatPhone, opportunityName, phoneHref } from '../format.ts'
import { plural } from '../settings.ts'
import type { Contact } from '../types.ts'

function Coordinates({ c }: { c: Contact }) {
  if (!c.email && !c.phone && !c.linkedin) return null
  return (
    <Stack gap={2}>
      {c.email && (
        <Anchor href={`mailto:${c.email}`} size="sm">
          <Group gap={4} wrap="nowrap">
            <IconMail size={14} style={{ flexShrink: 0 }} />
            <Text span size="sm" truncate>
              {c.email}
            </Text>
          </Group>
        </Anchor>
      )}
      {c.phone && (
        <Anchor href={phoneHref(c.phone)} size="sm">
          <Group gap={4} wrap="nowrap">
            <IconPhone size={14} />
            {formatPhone(c.phone)}
          </Group>
        </Anchor>
      )}
      {c.linkedin && (
        <Anchor href={c.linkedin} target="_blank" rel="noreferrer" size="sm">
          <Group gap={4} wrap="nowrap">
            <IconBrandLinkedin size={14} />
            LinkedIn
          </Group>
        </Anchor>
      )}
    </Stack>
  )
}

/** Pistes du contact, toutes campagnes confondues. */
function Opportunities({ c }: { c: Contact }) {
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
          key={o.id}
          component={Link}
          to={`/pistes/${o.id}`}
          color={o.stage.color}
          variant="light"
          style={{ cursor: 'pointer', textTransform: 'none' }}
          title={`${o.stage.label} · ${o.campaign.name}`}
        >
          {opportunityName(o)}
          {o.intermediary && o.company ? ` via ${o.intermediary.name}` : ''}
        </Badge>
      ))}
    </Group>
  )
}

function LastExchange({ c }: { c: Contact }) {
  const parts = [
    c.interviewCount ? plural(c.interviewCount, 'entretien') : null,
    c.lastInteractionAt
      ? `${plural(c.interactionCount, 'échange')} (dernier le ${formatDay(c.lastInteractionAt)})`
      : null,
  ].filter(Boolean)
  if (!parts.length) return null
  return (
    <Text size="xs" c="dimmed">
      {parts.join(' · ')}
    </Text>
  )
}

function ContactMenu({ c }: { c: Contact }) {
  const { remove } = useContactMutations()
  const confirmRemove = () =>
    modals.openConfirmModal({
      title: `Supprimer ${c.name} du carnet ?`,
      children: (
        <Text size="sm">
          {c.opportunities.length > 0 &&
            `Il sera retiré de ${plural(c.opportunities.length, 'piste')}. `}
          {c.interactionCount > 0 &&
            `${plural(c.interactionCount, 'échange')} du journal ${
              c.interactionCount > 1 ? 'sont conservés' : 'est conservé'
            }, sans interlocuteur.`}
          {!c.opportunities.length && !c.interactionCount && "Il n'est utilisé nulle part."}
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
        <Menu.Item
          leftSection={<IconPencil size={14} />}
          onClick={() => openContactModal({ contact: c })}
        >
          Modifier
        </Menu.Item>
        <Menu.Item color="red" leftSection={<IconTrash size={14} />} onClick={confirmRemove}>
          Supprimer
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  )
}

function NameCell({ c }: { c: Contact }) {
  const details = contactDetails(c)
  return (
    <div>
      <Anchor
        component="button"
        type="button"
        fw={600}
        size="sm"
        c="var(--mantine-color-text)"
        ta="left"
        onClick={() => openContactModal({ contact: c })}
      >
        {c.name}
      </Anchor>
      {details && (
        <Text size="sm" c="dimmed">
          {details}
        </Text>
      )}
    </div>
  )
}

function ContactsTable({ contacts }: { contacts: Contact[] }) {
  return (
    <Table verticalSpacing="sm" highlightOnHover>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Nom</Table.Th>
          <Table.Th>Coordonnées</Table.Th>
          <Table.Th>Pistes</Table.Th>
          <Table.Th w={40} />
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {contacts.map((c) => (
          <Table.Tr key={c.id}>
            <Table.Td maw={280}>
              <NameCell c={c} />
              {c.notes && (
                <Text size="xs" c="dimmed" lineClamp={2} mt={2}>
                  {c.notes}
                </Text>
              )}
            </Table.Td>
            <Table.Td maw={260}>
              <Coordinates c={c} />
            </Table.Td>
            <Table.Td>
              <Opportunities c={c} />
              <Box mt={4}>
                <LastExchange c={c} />
              </Box>
            </Table.Td>
            <Table.Td>
              <ContactMenu c={c} />
            </Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  )
}

function ContactCards({ contacts }: { contacts: Contact[] }) {
  return (
    <Stack gap="sm">
      {contacts.map((c) => (
        <Card key={c.id} withBorder padding="sm">
          <Group justify="space-between" wrap="nowrap" align="flex-start">
            <NameCell c={c} />
            <ContactMenu c={c} />
          </Group>
          <Box mt={6}>
            <Coordinates c={c} />
          </Box>
          <Box mt={8}>
            <Opportunities c={c} />
          </Box>
          <Box mt={4}>
            <LastExchange c={c} />
          </Box>
        </Card>
      ))}
    </Stack>
  )
}

/** Valeur du filtre pour les contacts sans entreprise. */
const NO_COMPANY = 'aucune'

/** Carnet de contacts : partagé entre toutes les pistes et campagnes. */
export function ContactsPage() {
  const { data, isPending } = useContacts()
  const [params, setParams] = useSearchParams()
  const search = params.get('q') ?? ''
  // Identifiant d'entreprise, ou « aucune » pour les contacts sans entreprise.
  const company = params.get('entreprise')
  const setParam = (key: string, value: string | null) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value) next.set(key, value)
        else next.delete(key)
        return next
      },
      { replace: true },
    )

  // Entreprises ayant au moins un contact, avec leur nombre de contacts.
  const companyCounts = new Map<number, { name: string; count: number }>()
  for (const c of data ?? []) {
    if (!c.company) continue
    const entry = companyCounts.get(c.company.id)
    if (entry) entry.count++
    else companyCounts.set(c.company.id, { name: c.company.name, count: 1 })
  }
  const companyOptions = [
    ...[...companyCounts]
      .sort(([, a], [, b]) => a.name.localeCompare(b.name, 'fr'))
      .map(([id, { name, count }]) => ({ value: String(id), label: `${name} (${count})` })),
    { value: NO_COMPANY, label: 'Sans entreprise' },
  ]
  const selectedCompany =
    company && company !== NO_COMPANY ? companyCounts.get(Number(company)) : null

  const q = normalizeSearch(search)
  const contacts = (data ?? []).filter(
    (c) =>
      (!q || contactSearchText(c).includes(q)) &&
      (!company || (company === NO_COMPANY ? !c.company : c.company?.id === Number(company))),
  )

  return (
    <Stack>
      <Group justify="space-between">
        <Group gap="xs">
          <Title order={2}>Contacts</Title>
          {data && (
            <Badge variant="default" size="lg">
              {data.length}
            </Badge>
          )}
        </Group>
        <Button
          leftSection={<IconPlus size={18} />}
          onClick={() =>
            // Filtré sur une entreprise : le nouveau contact y est rattaché d'office.
            openContactModal({ initial: { companyName: selectedCompany?.name ?? null } })
          }
        >
          Nouveau contact
        </Button>
      </Group>
      <Text size="sm" c="dimmed" mt={-8}>
        Recruteurs, RH, clients… Saisis-les une fois ici, puis choisis-les sur les pistes et dans le
        journal.
      </Text>

      <Group gap="sm" align="flex-start">
        <TextInput
          placeholder="Rechercher (nom, fonction, société, email, téléphone)"
          leftSection={<IconSearch size={16} />}
          value={search}
          onChange={(e) => setParam('q', e.currentTarget.value)}
          style={{ flex: '1 1 260px' }}
        />
        <Select
          placeholder="Toutes les entreprises"
          aria-label="Entreprise"
          leftSection={<IconBuildingSkyscraper size={16} />}
          data={companyOptions}
          value={company}
          onChange={(v) => setParam('entreprise', v)}
          searchable
          clearable
          nothingFoundMessage="Aucune entreprise"
          style={{ flex: '1 1 220px' }}
          maw={{ sm: 320 }}
        />
      </Group>

      {isPending ? (
        <Center py="xl">
          <Loader />
        </Center>
      ) : contacts.length === 0 ? (
        <Text c="dimmed" ta="center" py="xl">
          {data?.length ? 'Aucun contact ne correspond.' : 'Le carnet est vide.'}
        </Text>
      ) : (
        <>
          <Box visibleFrom="md">
            <ContactsTable contacts={contacts} />
          </Box>
          <Box hiddenFrom="md">
            <ContactCards contacts={contacts} />
          </Box>
        </>
      )}
    </Stack>
  )
}
