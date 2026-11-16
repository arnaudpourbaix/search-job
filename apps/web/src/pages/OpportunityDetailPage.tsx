import {
  ActionIcon,
  Alert,
  Anchor,
  Badge,
  Button,
  Card,
  Center,
  Checkbox,
  Grid,
  Group,
  Loader,
  Menu,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
  Timeline,
  Title,
} from '@mantine/core'
import { DateInput } from '@mantine/dates'
import { useForm } from '@mantine/form'
import { useDisclosure } from '@mantine/hooks'
import { modals } from '@mantine/modals'
import { notifications } from '@mantine/notifications'
import {
  IconArrowLeft,
  IconDots,
  IconExternalLink,
  IconMail,
  IconMessage,
  IconPencil,
  IconPhone,
  IconPlus,
  IconTrash,
} from '@tabler/icons-react'
import type { ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { DueBadge, DuplicateCompanyIcon, StaleIcon } from '../components/badges.tsx'
import { OpportunityModal } from '../components/OpportunityModal.tsx'
import {
  formatDay,
  formatPay,
  isStale,
  opportunityName,
  STAGE_COLORS,
  STAGE_LABELS,
  today,
} from '../format.ts'
import {
  useDeleteOpportunity,
  useJournal,
  useOpportunity,
  useRefLists,
  useUpdateOpportunity,
} from '../queries.ts'
import { STAGES, type OpportunityDetail, type Stage } from '../types.ts'

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
        {label}
      </Text>
      <Text size="sm" component="div">
        {children ?? '—'}
      </Text>
    </div>
  )
}

function InfoCard({ o }: { o: OpportunityDetail }) {
  return (
    <Card withBorder>
      <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="md">
        <Field label="Entreprise">
          {o.company ? (
            <Group gap={4}>
              {o.company.name}
              {o.duplicateCompany && <DuplicateCompanyIcon />}
            </Group>
          ) : (
            <Text span size="sm" c="dimmed" fs="italic">
              Inconnue
            </Text>
          )}
        </Field>
        <Field label="Intermédiaire">
          {o.intermediary
            ? [o.intermediary.name, o.intermediaryType].filter(Boolean).join(' · ')
            : 'Aucun (en direct)'}
        </Field>
        <Field label="Contact">
          {o.contact && (
            <Stack gap={2}>
              <span>{o.contact.name}</span>
              {o.contact.email && (
                <Anchor href={`mailto:${o.contact.email}`} size="sm">
                  <Group gap={4} wrap="nowrap">
                    <IconMail size={14} />
                    {o.contact.email}
                  </Group>
                </Anchor>
              )}
              {o.contact.phone && (
                <Anchor href={`tel:${o.contact.phone.replace(/\s/g, '')}`} size="sm">
                  <Group gap={4} wrap="nowrap">
                    <IconPhone size={14} />
                    {o.contact.phone}
                  </Group>
                </Anchor>
              )}
            </Stack>
          )}
        </Field>
        <Field label="Contrat · plateforme">
          {[o.contractType, o.platform].filter(Boolean).join(' · ') || null}
        </Field>
        <Field label="Rémunération">{formatPay(o)}</Field>
        <Field label="Lieu · télétravail · durée">
          {[
            o.location,
            o.remoteDays !== null ? `${o.remoteDays} j/sem` : null,
            o.duration,
          ]
            .filter(Boolean)
            .join(' · ') || null}
        </Field>
        <Field label="Référence de l'annonce">{o.reference}</Field>
        <Field label="1er contact">{formatDay(o.firstContactAt)}</Field>
        <Field label="Dernier contact">
          <Group gap={4}>
            {formatDay(o.lastContactAt)}
            {isStale(o) && <StaleIcon />}
          </Group>
        </Field>
      </SimpleGrid>

      {o.tags.length > 0 && (
        <Group gap={6} mt="md">
          {o.tags.map((t) => (
            <Badge key={t} variant="outline" color="gray">
              {t}
            </Badge>
          ))}
        </Group>
      )}

      {o.url && (
        <Anchor href={o.url} target="_blank" rel="noreferrer" size="sm" mt="md">
          <Group gap={4} wrap="nowrap">
            <IconExternalLink size={14} />
            Voir l'annonce
          </Group>
        </Anchor>
      )}

      {o.notes && (
        <Text size="sm" mt="md" style={{ whiteSpace: 'pre-wrap' }}>
          {o.notes}
        </Text>
      )}
    </Card>
  )
}

function ActionsCard({ o }: { o: OpportunityDetail }) {
  const { addAction, updateAction, removeAction } = useJournal(o.id)
  const form = useForm<{ label: string; dueDate: string | null }>({
    initialValues: { label: '', dueDate: null },
    validate: { label: (v) => (v.trim() ? null : 'Action obligatoire') },
  })

  return (
    <Card withBorder>
      <Title order={4} mb="sm">
        Actions
      </Title>
      <Stack gap="xs">
        {o.actions.length === 0 && (
          <Text size="sm" c="dimmed">
            Aucune action.
          </Text>
        )}
        {o.actions.map((a) => (
          <Group key={a.id} justify="space-between" wrap="nowrap" gap="xs">
            <Checkbox
              checked={a.doneAt !== null}
              onChange={(e) =>
                updateAction.mutate({ id: a.id, done: e.currentTarget.checked })
              }
              label={
                <Text size="sm" td={a.doneAt ? 'line-through' : undefined} c={a.doneAt ? 'dimmed' : undefined}>
                  {a.label}
                </Text>
              }
            />
            <Group gap={4} wrap="nowrap">
              {!a.doneAt && <DueBadge dueDate={a.dueDate} />}
              <ActionIcon
                variant="subtle"
                color="gray"
                aria-label="Supprimer l'action"
                onClick={() => removeAction.mutate(a.id)}
              >
                <IconTrash size={16} />
              </ActionIcon>
            </Group>
          </Group>
        ))}
      </Stack>

      <form
        onSubmit={form.onSubmit((v) =>
          addAction.mutate(
            { label: v.label.trim(), dueDate: v.dueDate },
            { onSuccess: () => form.reset() },
          ),
        )}
      >
        <Group mt="md" gap="xs" align="flex-start">
          <TextInput
            placeholder="Nouvelle action (ex. Rappeler)"
            style={{ flex: '1 1 180px' }}
            {...form.getInputProps('label')}
          />
          <DateInput
            placeholder="Échéance"
            valueFormat="DD/MM/YYYY"
            locale="fr"
            clearable
            style={{ flex: '0 1 150px' }}
            {...form.getInputProps('dueDate')}
          />
          <ActionIcon type="submit" size="lg" aria-label="Ajouter l'action" loading={addAction.isPending}>
            <IconPlus size={18} />
          </ActionIcon>
        </Group>
      </form>
    </Card>
  )
}

function JournalCard({ o }: { o: OpportunityDetail }) {
  const { addInteraction, removeInteraction } = useJournal(o.id)
  const { data: lists } = useRefLists()
  const form = useForm<{ date: string | null; channel: string | null; summary: string }>({
    initialValues: { date: today(), channel: null, summary: '' },
    validate: {
      date: (v) => (v ? null : 'Date obligatoire'),
      summary: (v) => (v.trim() ? null : 'Résumé obligatoire'),
    },
  })

  return (
    <Card withBorder>
      <Title order={4} mb="sm">
        Journal
      </Title>

      <form
        onSubmit={form.onSubmit((v) =>
          addInteraction.mutate(
            { date: v.date!, channel: v.channel, summary: v.summary.trim() },
            { onSuccess: () => form.setFieldValue('summary', '') },
          ),
        )}
      >
        <Stack gap="xs" mb="lg">
          <Group gap="xs" grow>
            <DateInput valueFormat="DD/MM/YYYY" locale="fr" maxDate={today()} {...form.getInputProps('date')} />
            <Select
              placeholder="Canal"
              data={lists?.CHANNEL ?? []}
              clearable
              {...form.getInputProps('channel')}
            />
          </Group>
          <Textarea
            placeholder="Résumé de l'échange"
            autosize
            minRows={2}
            {...form.getInputProps('summary')}
          />
          <Group justify="flex-end">
            <Button type="submit" size="xs" leftSection={<IconPlus size={14} />} loading={addInteraction.isPending}>
              Ajouter l'échange
            </Button>
          </Group>
        </Stack>
      </form>

      {o.interactions.length === 0 ? (
        <Text size="sm" c="dimmed">
          Aucun échange.
        </Text>
      ) : (
        <Timeline bulletSize={22} lineWidth={2}>
          {o.interactions.map((i) => (
            <Timeline.Item
              key={i.id}
              bullet={<IconMessage size={12} />}
              title={
                <Group justify="space-between" wrap="nowrap">
                  <Text size="sm" fw={500}>
                    {formatDay(i.date)}
                    {i.channel && (
                      <Text span c="dimmed" size="sm">
                        {' · '}
                        {i.channel}
                      </Text>
                    )}
                  </Text>
                  <ActionIcon
                    variant="subtle"
                    color="gray"
                    size="sm"
                    aria-label="Supprimer l'échange"
                    onClick={() => removeInteraction.mutate(i.id)}
                  >
                    <IconTrash size={14} />
                  </ActionIcon>
                </Group>
              }
            >
              <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
                {i.summary}
              </Text>
            </Timeline.Item>
          ))}
        </Timeline>
      )}
    </Card>
  )
}

export function OpportunityDetailPage() {
  const id = Number(useParams().id)
  const navigate = useNavigate()
  const { data: o, isPending, isError, error } = useOpportunity(id)
  const update = useUpdateOpportunity(id)
  const remove = useDeleteOpportunity()
  const [editing, { open, close }] = useDisclosure()

  if (isPending) {
    return (
      <Center p="xl">
        <Loader />
      </Center>
    )
  }
  if (isError) {
    return (
      <Alert color="red" title="Piste introuvable">
        {error.message}
      </Alert>
    )
  }

  const confirmDelete = () =>
    modals.openConfirmModal({
      title: 'Supprimer la piste ?',
      children: (
        <Text size="sm">
          La piste « {opportunityName(o)} » sera supprimée avec son journal et ses actions. Cette action est
          définitive.
        </Text>
      ),
      labels: { confirm: 'Supprimer', cancel: 'Annuler' },
      confirmProps: { color: 'red' },
      onConfirm: () =>
        remove.mutate(o.id, {
          onSuccess: () => {
            notifications.show({ message: 'Piste supprimée' })
            void navigate('/pistes')
          },
        }),
    })

  return (
    <Stack>
      <Anchor component={Link} to="/pistes" size="sm">
        <Group gap={4}>
          <IconArrowLeft size={14} />
          Pistes
        </Group>
      </Anchor>

      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <div style={{ minWidth: 0 }}>
          <Title order={2} fs={o.company ? undefined : 'italic'}>
            {opportunityName(o)}
          </Title>
          <Text c="dimmed">
            {[o.title, o.intermediary && `via ${o.intermediary.name}`]
              .filter(Boolean)
              .join(' · ') || null}
          </Text>
        </div>
        <Group gap="xs" wrap="nowrap">
          <Select
            aria-label="Étape"
            data={STAGES.map((s) => ({ value: s, label: STAGE_LABELS[s] }))}
            value={o.stage}
            allowDeselect={false}
            onChange={(stage) => stage && update.mutate({ stage: stage as Stage })}
            w={180}
            visibleFrom="xs"
            styles={{ input: { color: `var(--mantine-color-${STAGE_COLORS[o.stage]}-text)`, fontWeight: 600 } }}
          />
          <Button
            variant="default"
            leftSection={<IconPencil size={16} />}
            onClick={open}
            visibleFrom="sm"
          >
            Modifier
          </Button>
          <Menu position="bottom-end">
            <Menu.Target>
              <ActionIcon variant="default" size="lg" aria-label="Plus d'options">
                <IconDots size={18} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item leftSection={<IconPencil size={16} />} onClick={open} hiddenFrom="sm">
                Modifier
              </Menu.Item>
              <Menu.Item color="red" leftSection={<IconTrash size={16} />} onClick={confirmDelete}>
                Supprimer
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>
      </Group>

      {/* Sur téléphone : étape sous le titre, pleine largeur. */}
      <Select
        hiddenFrom="xs"
        aria-label="Étape"
        data={STAGES.map((s) => ({ value: s, label: STAGE_LABELS[s] }))}
        value={o.stage}
        allowDeselect={false}
        onChange={(stage) => stage && update.mutate({ stage: stage as Stage })}
      />

      <Grid>
        <Grid.Col span={{ base: 12, md: 7 }}>
          <Stack>
            <InfoCard o={o} />
            <ActionsCard o={o} />
          </Stack>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 5 }}>
          <JournalCard o={o} />
        </Grid.Col>
      </Grid>

      <OpportunityModal opened={editing} onClose={close} opportunity={o} />
    </Stack>
  )
}
