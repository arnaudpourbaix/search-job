import {
  ActionIcon,
  Alert,
  Anchor,
  Badge,
  Box,
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
  ThemeIcon,
  Timeline,
  Title,
  Tooltip,
} from '@mantine/core'
import { DateInput } from '@mantine/dates'
import { useForm } from '@mantine/form'
import { useDisclosure } from '@mantine/hooks'
import { modals } from '@mantine/modals'
import { notifications } from '@mantine/notifications'
import {
  IconArrowLeft,
  IconCheck,
  IconDots,
  IconExternalLink,
  IconHourglass,
  IconMessage,
  IconPencil,
  IconPlus,
  IconTrash,
} from '@tabler/icons-react'
import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { DueBadge, DuplicateCompanyIcon, StaleIcon } from '../components/badges.tsx'
import { ContactLines } from '../components/ContactLines.tsx'
import { ContactNames } from '../components/ContactNames.tsx'
import { ContactSelect } from '../components/ContactPicker.tsx'
import { InterviewsCard } from '../components/InterviewsCard.tsx'
import { OpportunityModal } from '../components/OpportunityModal.tsx'
import { ROUND_STATE_INFO, roundState, roundTitle } from '../interviews.ts'
import {
  daysBetween,
  formatAge,
  formatDay,
  formatPay,
  isClosed,
  isStale,
  opportunityName,
  opportunityStart,
  today,
} from '../format.ts'
import {
  useDeleteOpportunity,
  useJournal,
  useOpportunity,
  useRefLists,
  useUpdateOpportunity,
} from '../queries.ts'
import { useStages } from '../settings.ts'
import type { InteractionInput } from '../queries.ts'
import type { Interaction, InterviewRound, OpportunityDetail } from '../types.ts'

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
        <Box style={{ gridColumn: '1 / -1' }}>
          <Field label={o.contacts.length > 1 ? 'Contacts' : 'Contact'}>
            {o.contacts.length > 0 && <ContactLines contacts={o.contacts} />}
          </Field>
        </Box>
        <Field label="Campagne">
          {o.campaign.endDate
            ? `${o.campaign.name} (terminée le ${formatDay(o.campaign.endDate)})`
            : o.campaign.name}
        </Field>
        <Field label="Contrat · plateforme">
          {[o.contractType, o.platform].filter(Boolean).join(' · ') || null}
        </Field>
        <Field label="Rémunération">{formatPay(o)}</Field>
        <Field label="Lieu · télétravail · durée">
          {[o.location, o.remoteDays !== null ? `${o.remoteDays} j/sem` : null, o.duration]
            .filter(Boolean)
            .join(' · ') || null}
        </Field>
        <Field label="Référence de l'annonce">{o.reference}</Field>
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

/**
 * Âge de la piste, bien visible sous le titre. Une piste close affiche la durée
 * qu'elle a duré (jusqu'à son dernier contact).
 */
function AgeBadge({ o }: { o: OpportunityDetail }) {
  const start = opportunityStart(o)
  const closed = isClosed(o.stage)
  const end = closed && o.lastContactAt && o.lastContactAt > start ? o.lastContactAt : today()
  const age = formatAge(daysBetween(start, end))
  const label = closed
    ? `A duré ${age === "aujourd'hui" ? '1 jour' : age}`
    : age === "aujourd'hui"
      ? "Ouverte aujourd'hui"
      : `Ouverte depuis ${age}`
  return (
    <Group gap={6} wrap="nowrap">
      <Tooltip label={`Piste ouverte le ${formatDay(start)}`}>
        <Badge
          size="lg"
          variant="light"
          color={closed ? 'gray' : 'blue'}
          leftSection={<IconHourglass size={14} />}
          tt="none"
        >
          {label}
        </Badge>
      </Tooltip>
      {isStale(o) && <StaleIcon />}
    </Group>
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
              onChange={(e) => updateAction.mutate({ id: a.id, done: e.currentTarget.checked })}
              label={
                <Text
                  size="sm"
                  td={a.doneAt ? 'line-through' : undefined}
                  c={a.doneAt ? 'dimmed' : undefined}
                >
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
          <ActionIcon
            type="submit"
            size="lg"
            aria-label="Ajouter l'action"
            loading={addAction.isPending}
          >
            <IconPlus size={18} />
          </ActionIcon>
        </Group>
      </form>
    </Card>
  )
}

type InteractionValues = {
  date: string | null
  channel: string | null
  summary: string
  contactId: number | null
}

/** Formulaire d'échange, pour l'ajout comme pour la modification. */
function InteractionForm({
  o,
  initial,
  submitLabel,
  loading,
  onSubmit,
  onCancel,
}: {
  o: OpportunityDetail
  initial: InteractionValues
  submitLabel: string
  loading: boolean
  onSubmit: (v: InteractionInput) => void
  onCancel?: () => void
}) {
  const { data: lists } = useRefLists()
  const form = useForm<InteractionValues>({
    initialValues: initial,
    validate: {
      date: (v) => (v ? null : 'Date obligatoire'),
      summary: (v) => (v.trim() ? null : 'Résumé obligatoire'),
    },
  })

  return (
    <form
      onSubmit={form.onSubmit((v) =>
        onSubmit({
          date: v.date!,
          channel: v.channel,
          summary: v.summary.trim(),
          contactId: v.contactId,
        }),
      )}
    >
      <Stack gap="xs">
        <Group gap="xs" grow>
          <DateInput
            valueFormat="DD/MM/YYYY"
            locale="fr"
            maxDate={today()}
            aria-label="Date de l'échange"
            {...form.getInputProps('date')}
          />
          <Select
            placeholder="Canal"
            aria-label="Canal"
            data={lists?.CHANNEL ?? []}
            clearable
            {...form.getInputProps('channel')}
          />
        </Group>
        <ContactSelect
          value={form.values.contactId}
          onChange={(id) => form.setFieldValue('contactId', id)}
          opportunityContacts={o.contacts}
          defaultCompany={o.intermediary?.name ?? o.company?.name ?? null}
        />
        <Textarea
          placeholder="Résumé de l'échange"
          aria-label="Résumé de l'échange"
          autosize
          minRows={2}
          data-autofocus={onCancel ? true : undefined}
          {...form.getInputProps('summary')}
        />
        <Group justify="flex-end" gap="xs">
          {onCancel && (
            <Button size="xs" variant="default" onClick={onCancel}>
              Annuler
            </Button>
          )}
          <Button type="submit" size="xs" leftSection={<IconCheck size={14} />} loading={loading}>
            {submitLabel}
          </Button>
        </Group>
      </Stack>
    </form>
  )
}

/** Montre un tour dans la carte « Processus de recrutement » (défilement + surbrillance). */
function showRound(id: number) {
  const el = document.getElementById(`round-${id}`)
  if (!el) return
  el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  el.animate(
    [{ backgroundColor: 'var(--mantine-color-yellow-light)' }, { backgroundColor: 'transparent' }],
    { duration: 1600, easing: 'ease-out' },
  )
}

/** Entretien ayant eu lieu, affiché dans l'historique (lecture seule). */
function RoundEntry({ r }: { r: InterviewRound & { date: string } }) {
  const info = ROUND_STATE_INFO[roundState(r)]
  return (
    <>
      <Group justify="space-between" wrap="nowrap" gap="xs" align="flex-start">
        <Text size="sm" fw={500}>
          {formatDay(r.date)}
          <Text span c="dimmed" size="sm">
            {' · '}
            {r.time ? `${r.time} · ` : ''}entretien
          </Text>
        </Text>
        <Badge color={info.color} variant="light" style={{ flexShrink: 0 }}>
          {info.label}
        </Badge>
      </Group>
      <Anchor
        component="button"
        type="button"
        size="sm"
        fw={600}
        ta="left"
        onClick={() => showRound(r.id)}
        title="Voir dans le processus de recrutement"
      >
        {roundTitle(r)}
      </Anchor>
      <ContactNames contacts={r.contacts} />
      {r.notes && (
        <Text size="sm" c="dimmed" lineClamp={4} style={{ whiteSpace: 'pre-wrap' }}>
          {r.notes}
        </Text>
      )}
    </>
  )
}

function JournalCard({ o }: { o: OpportunityDetail }) {
  const { addInteraction, updateInteraction, removeInteraction } = useJournal(o.id)
  // Échange en cours de modification, ou 'new' pour la saisie d'un nouvel échange.
  const [editingId, setEditingId] = useState<number | 'new' | null>(null)

  // Échanges du journal et entretiens ayant eu lieu, du plus récent au plus ancien
  // (à date égale, l'entretien d'abord).
  const history = [
    ...o.interviews
      .filter((r): r is InterviewRound & { date: string } => r.status !== 'PLANNED' && !!r.date)
      .map((round) => ({ date: round.date, round, interaction: null })),
    ...o.interactions.map((interaction) => ({
      date: interaction.date,
      round: null,
      interaction,
    })),
  ].sort((a, b) => b.date.localeCompare(a.date) || (a.round ? -1 : b.round ? 1 : 0)) as (
    | {
        date: string
        round: InterviewRound & { date: string }
        interaction: null
      }
    | { date: string; round: null; interaction: Interaction }
  )[]

  const confirmRemove = (i: Interaction) =>
    modals.openConfirmModal({
      title: "Supprimer l'échange ?",
      children: (
        <Text size="sm">L'échange du {formatDay(i.date)} sera supprimé définitivement.</Text>
      ),
      labels: { confirm: 'Supprimer', cancel: 'Annuler' },
      confirmProps: { color: 'red' },
      onConfirm: () => removeInteraction.mutate(i.id),
    })

  return (
    <Card withBorder>
      <Group justify="space-between" mb={4} gap="xs" align="flex-start">
        <Title order={4}>Échanges et historique</Title>
        {editingId !== 'new' && (
          <Button
            size="xs"
            variant="light"
            leftSection={<IconPlus size={14} />}
            onClick={() => setEditingId('new')}
          >
            Ajouter un échange
          </Button>
        )}
      </Group>
      <Text size="sm" c="dimmed" mb="sm">
        Relances, mails, appels… Les entretiens passés s'ajoutent d'eux-mêmes depuis le processus.
      </Text>

      {editingId === 'new' && (
        <Card withBorder mb="lg" padding="sm" bg="var(--mantine-color-default-hover)">
          <Text size="sm" fw={600} mb="xs">
            Nouvel échange
          </Text>
          <InteractionForm
            o={o}
            initial={{
              date: today(),
              channel: null,
              summary: '',
              // Un seul contact sur la piste : proposé par défaut.
              contactId: o.contacts.length === 1 ? o.contacts[0].id : null,
            }}
            submitLabel="Ajouter"
            loading={addInteraction.isPending}
            onCancel={() => setEditingId(null)}
            onSubmit={(v) => addInteraction.mutate(v, { onSuccess: () => setEditingId(null) })}
          />
        </Card>
      )}

      {history.length === 0 ? (
        editingId !== 'new' && (
          <Text size="sm" c="dimmed">
            Aucun échange pour l'instant.
          </Text>
        )
      ) : (
        <Timeline bulletSize={22} lineWidth={2}>
          {history.map(({ interaction: i, round }) => {
            if (round) {
              const info = ROUND_STATE_INFO[roundState(round)]
              const RoundIcon = info.icon
              return (
                <Timeline.Item
                  key={`round-${round.id}`}
                  bullet={
                    <ThemeIcon size={22} radius="xl" color={info.color}>
                      <RoundIcon size={12} />
                    </ThemeIcon>
                  }
                  title={<RoundEntry r={round} />}
                />
              )
            }
            return (
              <Timeline.Item
                key={i.id}
                bullet={<IconMessage size={12} />}
                title={
                  editingId === i.id ? undefined : (
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
                      <Group gap={2} wrap="nowrap">
                        <ActionIcon
                          variant="subtle"
                          color="gray"
                          size="sm"
                          aria-label="Modifier l'échange"
                          onClick={() => setEditingId(i.id)}
                        >
                          <IconPencil size={14} />
                        </ActionIcon>
                        <ActionIcon
                          variant="subtle"
                          color="gray"
                          size="sm"
                          aria-label="Supprimer l'échange"
                          onClick={() => confirmRemove(i)}
                        >
                          <IconTrash size={14} />
                        </ActionIcon>
                      </Group>
                    </Group>
                  )
                }
              >
                {editingId === i.id ? (
                  <InteractionForm
                    o={o}
                    initial={{
                      date: i.date,
                      channel: i.channel,
                      summary: i.summary,
                      contactId: i.contact?.id ?? null,
                    }}
                    submitLabel="Enregistrer"
                    loading={updateInteraction.isPending}
                    onCancel={() => setEditingId(null)}
                    onSubmit={(v) =>
                      updateInteraction.mutate(
                        { id: i.id, ...v },
                        { onSuccess: () => setEditingId(null) },
                      )
                    }
                  />
                ) : (
                  <>
                    {i.contact && <ContactNames contacts={[i.contact]} />}
                    <Text
                      size="sm"
                      style={{ whiteSpace: 'pre-wrap', cursor: 'text' }}
                      title="Double-clic pour modifier"
                      onDoubleClick={() => setEditingId(i.id)}
                    >
                      {i.summary}
                    </Text>
                  </>
                )}
              </Timeline.Item>
            )
          })}
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
  const { data: stages = [] } = useStages()
  const stageOptions = stages.map((s) => ({
    value: String(s.id),
    label: s.label,
  }))
  const changeStage = (value: string | null) => value && update.mutate({ stageId: Number(value) })

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

  // Processus en tête dès qu'il a commencé (ou que la piste est à une étape avancée).
  const interviewsFirst = o.interviews.length > 0 || o.stage.kind === 'ADVANCED'

  const confirmDelete = () =>
    modals.openConfirmModal({
      title: 'Supprimer la piste ?',
      children: (
        <Text size="sm">
          La piste « {opportunityName(o)} » sera supprimée avec son journal et ses actions. Cette
          action est définitive.
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
          <Box mt={6}>
            <AgeBadge o={o} />
          </Box>
        </div>
        <Group gap="xs" wrap="nowrap">
          <Select
            aria-label="Étape"
            data={stageOptions}
            value={String(o.stage.id)}
            allowDeselect={false}
            onChange={changeStage}
            w={180}
            visibleFrom="xs"
            styles={{
              input: {
                color: `var(--mantine-color-${o.stage.color}-text)`,
                fontWeight: 600,
              },
            }}
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
        data={stageOptions}
        value={String(o.stage.id)}
        allowDeselect={false}
        onChange={changeStage}
      />

      <Grid>
        <Grid.Col span={{ base: 12, md: 7 }}>
          <Stack>
            {interviewsFirst && <InterviewsCard o={o} />}
            <InfoCard o={o} />
            <ActionsCard o={o} />
            {!interviewsFirst && <InterviewsCard o={o} />}
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
