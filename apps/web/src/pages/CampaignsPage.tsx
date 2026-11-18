import {
  Alert,
  Badge,
  Button,
  Card,
  Center,
  Checkbox,
  Group,
  Loader,
  Menu,
  ActionIcon,
  Modal,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core'
import { DateInput } from '@mantine/dates'
import { useForm } from '@mantine/form'
import { useDisclosure, useMediaQuery } from '@mantine/hooks'
import { modals } from '@mantine/modals'
import { notifications } from '@mantine/notifications'
import {
  IconArchive,
  IconArrowBackUp,
  IconBriefcase,
  IconDots,
  IconPencil,
  IconPlus,
  IconTrash,
} from '@tabler/icons-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import {
  useCampaignMutations,
  useCampaigns,
  useCampaignSelection,
  type Campaign,
} from '../campaigns.ts'
import { formatDay, today } from '../format.ts'

/** Création (campaign absente) ou modification d'une campagne. */
function CampaignModal({
  opened,
  onClose,
  campaign,
  hasOpenCampaign,
}: {
  opened: boolean
  onClose: () => void
  campaign?: Campaign
  hasOpenCampaign: boolean
}) {
  const mobile = useMediaQuery('(max-width: 48em)')
  const { create, update } = useCampaignMutations()
  const { select } = useCampaignSelection()
  const form = useForm({
    initialValues: {
      name: campaign?.name ?? '',
      goal: campaign?.goal ?? '',
      startDate: campaign?.startDate ?? today(),
      endDate: campaign?.endDate ?? null,
      closeOthers: hasOpenCampaign,
    },
    validate: {
      name: (v) => (v.trim() ? null : 'Nom obligatoire'),
      startDate: (v) => (v ? null : 'Date de début obligatoire'),
      endDate: (v, all) =>
        v && all.startDate && v < all.startDate ? 'La fin doit suivre le début' : null,
    },
  })

  const submit = form.onSubmit((v) => {
    const input = { name: v.name.trim(), goal: v.goal.trim() || null, startDate: v.startDate }
    if (campaign) {
      update.mutate(
        { id: campaign.id, ...input, endDate: v.endDate || null },
        { onSuccess: onClose },
      )
    } else {
      create.mutate(
        { ...input, closeOthers: v.closeOthers },
        {
          onSuccess: (created) => {
            // La nouvelle campagne devient celle affichée.
            select(String(created.id))
            notifications.show({ color: 'green', message: `Campagne « ${created.name} » créée` })
            onClose()
          },
        },
      )
    }
  })

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={campaign ? `Modifier « ${campaign.name} »` : 'Nouvelle campagne'}
      fullScreen={mobile}
    >
      <form onSubmit={submit}>
        <Stack>
          <TextInput
            label="Nom"
            placeholder="ex. Mission juillet 2027"
            data-autofocus
            {...form.getInputProps('name')}
          />
          <Textarea
            label="Objectif"
            placeholder="Type de poste, TJM ou salaire visé, date de démarrage…"
            autosize
            minRows={2}
            {...form.getInputProps('goal')}
          />
          <SimpleGrid cols={2}>
            <DateInput
              label="Début"
              valueFormat="DD/MM/YYYY"
              locale="fr"
              {...form.getInputProps('startDate')}
            />
            {campaign && (
              <DateInput
                label="Fin"
                description="Vide = en cours"
                valueFormat="DD/MM/YYYY"
                locale="fr"
                clearable
                {...form.getInputProps('endDate')}
              />
            )}
          </SimpleGrid>
          {!campaign && hasOpenCampaign && (
            <Checkbox
              label="Clôturer la campagne en cours (fin la veille du début)"
              {...form.getInputProps('closeOthers', { type: 'checkbox' })}
            />
          )}
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" loading={create.isPending || update.isPending}>
              {campaign ? 'Enregistrer' : 'Créer'}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  )
}

function Stat({ value, label, color }: { value: number; label: string; color?: string }) {
  return (
    <div>
      <Text fw={700} size="xl" c={color} lh={1.1}>
        {value}
      </Text>
      <Text size="xs" c="dimmed">
        {label}
      </Text>
    </div>
  )
}

function CampaignCard({ c, onEdit }: { c: Campaign; onEdit: () => void }) {
  const navigate = useNavigate()
  const { select } = useCampaignSelection()
  const { update, remove } = useCampaignMutations()
  const closed = !!c.endDate

  const toggleClosed = () =>
    update.mutate(
      { id: c.id, endDate: closed ? null : today() },
      {
        onSuccess: () =>
          notifications.show({
            message: closed ? `« ${c.name} » rouverte` : `« ${c.name} » clôturée`,
          }),
      },
    )

  const confirmRemove = () =>
    modals.openConfirmModal({
      title: `Supprimer « ${c.name} » ?`,
      children: <Text size="sm">La campagne est vide, rien d'autre ne sera supprimé.</Text>,
      labels: { confirm: 'Supprimer', cancel: 'Annuler' },
      confirmProps: { color: 'red' },
      onConfirm: () => remove.mutate(c.id),
    })

  return (
    <Card withBorder style={{ opacity: closed ? 0.85 : 1 }}>
      <Group justify="space-between" wrap="nowrap" align="flex-start">
        <div style={{ minWidth: 0 }}>
          <Group gap="xs">
            <Title order={4}>{c.name}</Title>
            <Badge color={closed ? 'gray' : 'green'} variant="light">
              {closed ? 'Terminée' : 'En cours'}
            </Badge>
          </Group>
          <Text size="sm" c="dimmed">
            {closed
              ? `Du ${formatDay(c.startDate)} au ${formatDay(c.endDate)}`
              : `Depuis le ${formatDay(c.startDate)}`}
          </Text>
        </div>
        <Menu position="bottom-end">
          <Menu.Target>
            <ActionIcon variant="subtle" color="gray" aria-label="Actions de la campagne">
              <IconDots size={18} />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item leftSection={<IconPencil size={14} />} onClick={onEdit}>
              Modifier
            </Menu.Item>
            <Menu.Item
              leftSection={closed ? <IconArrowBackUp size={14} /> : <IconArchive size={14} />}
              onClick={toggleClosed}
            >
              {closed ? 'Rouvrir' : "Clôturer aujourd'hui"}
            </Menu.Item>
            <Menu.Item
              color="red"
              leftSection={<IconTrash size={14} />}
              disabled={c.total > 0}
              onClick={confirmRemove}
            >
              {c.total > 0 ? 'Supprimer (déplacer ses pistes avant)' : 'Supprimer'}
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Group>

      {c.goal && (
        <Text size="sm" mt="sm" style={{ whiteSpace: 'pre-line' }}>
          {c.goal}
        </Text>
      )}

      <Group mt="md" gap="xl">
        <Stat value={c.total} label={c.total > 1 ? 'pistes' : 'piste'} />
        <Stat value={c.active} label={c.active > 1 ? 'actives' : 'active'} color="blue" />
        <Stat value={c.won} label={c.won > 1 ? 'gagnées' : 'gagnée'} color="green" />
      </Group>

      <Group mt="md">
        <Button
          variant="light"
          size="xs"
          leftSection={<IconBriefcase size={14} />}
          onClick={() => {
            select(String(c.id))
            void navigate('/pistes')
          }}
        >
          Voir les pistes
        </Button>
      </Group>
    </Card>
  )
}

export function CampaignsPage() {
  const { data, isPending, isError, error } = useCampaigns()
  const [creating, { open, close }] = useDisclosure()
  const [editing, setEditing] = useState<Campaign | null>(null)
  const hasOpenCampaign = !!data?.some((c) => !c.endDate)

  return (
    <Stack>
      <Group justify="space-between">
        <div>
          <Title order={2}>Campagnes</Title>
          <Text c="dimmed" size="sm">
            Une campagne regroupe les pistes d'une recherche. Les campagnes terminées restent
            consultables (choix « Toutes les campagnes » en haut pour chercher un contact).
          </Text>
        </div>
        <Button leftSection={<IconPlus size={18} />} onClick={open}>
          Nouvelle campagne
        </Button>
      </Group>

      {isPending ? (
        <Center p="xl">
          <Loader />
        </Center>
      ) : isError ? (
        <Alert color="red" title="Impossible de charger les campagnes">
          {error.message}
        </Alert>
      ) : data.length === 0 ? (
        <Text c="dimmed" ta="center" p="xl">
          Aucune campagne : crée la première pour commencer à suivre des pistes.
        </Text>
      ) : (
        <SimpleGrid cols={{ base: 1, md: 2 }}>
          {data.map((c) => (
            <CampaignCard key={c.id} c={c} onEdit={() => setEditing(c)} />
          ))}
        </SimpleGrid>
      )}

      <CampaignModal
        key={creating ? 'new-open' : 'new'}
        opened={creating}
        onClose={close}
        hasOpenCampaign={hasOpenCampaign}
      />
      <CampaignModal
        key={editing?.id ?? 'edit'}
        opened={!!editing}
        onClose={() => setEditing(null)}
        campaign={editing ?? undefined}
        hasOpenCampaign={hasOpenCampaign}
      />
    </Stack>
  )
}
