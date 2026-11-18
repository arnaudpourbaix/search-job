import {
  ActionIcon,
  Autocomplete,
  Badge,
  Button,
  Card,
  Group,
  Menu,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
  ThemeIcon,
  Timeline,
  Title,
  UnstyledButton,
} from '@mantine/core'
import { DateInput, TimeInput } from '@mantine/dates'
import { useForm } from '@mantine/form'
import { modals } from '@mantine/modals'
import {
  IconArrowDown,
  IconArrowUp,
  IconCheck,
  IconChevronDown,
  IconDots,
  IconPencil,
  IconPlus,
  IconTrash,
  IconX,
} from '@tabler/icons-react'
import { useState } from 'react'
import {
  ROUND_STATE_INFO,
  roundState,
  roundTitle,
  roundWhen,
  STATUS_LABELS,
  useInterviews,
  type InterviewInput,
} from '../interviews.ts'
import { useRefLists } from '../queries.ts'
import { ContactNames } from './ContactNames.tsx'
import { ContactsPicker } from './ContactPicker.tsx'
import type { InterviewRound, InterviewStatus, OpportunityDetail } from '../types.ts'

const STATUS_OPTIONS = (Object.keys(STATUS_LABELS) as InterviewStatus[]).map((s) => ({
  value: s,
  label: STATUS_LABELS[s],
}))

/** Ajout ou modification d'un tour. */
function RoundForm({
  o,
  initial,
  submitLabel,
  loading,
  onSubmit,
  onCancel,
}: {
  o: OpportunityDetail
  initial: InterviewInput
  submitLabel: string
  loading: boolean
  onSubmit: (v: InterviewInput) => void
  onCancel: () => void
}) {
  const { data: lists } = useRefLists()
  const form = useForm<InterviewInput>({
    initialValues: initial,
    validate: { type: (v) => (v.trim() ? null : 'Type obligatoire') },
  })
  const clean = (v: string | null) => v?.trim() || null

  return (
    <form
      onSubmit={form.onSubmit((v) =>
        onSubmit({
          type: v.type.trim(),
          label: clean(v.label),
          date: v.date,
          time: clean(v.time),
          status: v.status,
          notes: clean(v.notes),
          contactIds: v.contactIds,
        }),
      )}
    >
      <Stack gap="xs">
        <Group gap="xs" grow align="flex-start">
          <Autocomplete
            label="Type"
            placeholder="Entretien RH, test…"
            data={lists?.INTERVIEW_TYPE ?? []}
            data-autofocus
            {...form.getInputProps('type')}
          />
          <TextInput
            label="Précision"
            placeholder="anglais, avec le manager…"
            {...form.getInputProps('label')}
            value={form.values.label ?? ''}
          />
        </Group>
        <Group gap="xs" grow align="flex-start">
          <DateInput
            label="Date"
            placeholder="À planifier"
            valueFormat="DD/MM/YYYY"
            locale="fr"
            clearable
            {...form.getInputProps('date')}
          />
          <TimeInput label="Heure" {...form.getInputProps('time')} value={form.values.time ?? ''} />
        </Group>
        <ContactsPicker
          label="Interlocuteurs"
          description="RH, manager, lead dev… choisis dans le carnet"
          value={form.values.contactIds}
          onChange={(ids) => form.setFieldValue('contactIds', ids)}
          opportunityContacts={o.contacts}
          defaultCompany={o.company?.name ?? o.intermediary?.name ?? null}
        />
        <Select
          label="Statut"
          data={STATUS_OPTIONS}
          allowDeselect={false}
          {...form.getInputProps('status')}
        />
        <Textarea
          label="Notes"
          placeholder="Préparation, ressenti, retour…"
          autosize
          minRows={2}
          {...form.getInputProps('notes')}
          value={form.values.notes ?? ''}
        />
        <Group justify="flex-end" gap="xs">
          <Button size="xs" variant="default" onClick={onCancel}>
            Annuler
          </Button>
          <Button type="submit" size="xs" leftSection={<IconCheck size={14} />} loading={loading}>
            {submitLabel}
          </Button>
        </Group>
      </Stack>
    </form>
  )
}

/** Badge de statut ; un clic ouvre le menu pour en changer. */
function StatusMenu({
  round,
  onChange,
}: {
  round: InterviewRound
  onChange: (s: InterviewStatus) => void
}) {
  const info = ROUND_STATE_INFO[roundState(round)]
  return (
    <Menu position="bottom-end" withinPortal>
      <Menu.Target>
        <UnstyledButton aria-label={`Statut : ${info.label}. Changer`}>
          <Badge
            color={info.color}
            variant="light"
            rightSection={<IconChevronDown size={12} />}
            style={{ cursor: 'pointer' }}
          >
            {info.label}
          </Badge>
        </UnstyledButton>
      </Menu.Target>
      <Menu.Dropdown>
        {STATUS_OPTIONS.map((o) => (
          <Menu.Item
            key={o.value}
            disabled={o.value === round.status}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  )
}

/**
 * Raccourcis sur le tour en cours : « planifier » tant qu'il n'a pas de date,
 * « c'est passé » ensuite, puis « validé » / « non retenu ».
 */
function QuickActions({
  round,
  onChange,
  onEdit,
}: {
  round: InterviewRound
  onChange: (s: InterviewStatus) => void
  onEdit: () => void
}) {
  if (round.status === 'PLANNED') {
    return (
      <Group gap={6}>
        {round.date ? (
          <Button size="compact-xs" variant="light" color="yellow" onClick={() => onChange('DONE')}>
            C'est passé
          </Button>
        ) : (
          <Button size="compact-xs" variant="light" onClick={onEdit}>
            Planifier
          </Button>
        )}
      </Group>
    )
  }
  if (round.status === 'DONE') {
    return (
      <Group gap={6}>
        <Button
          size="compact-xs"
          variant="light"
          color="green"
          leftSection={<IconCheck size={12} />}
          onClick={() => onChange('PASSED')}
        >
          Validé
        </Button>
        <Button
          size="compact-xs"
          variant="light"
          color="red"
          leftSection={<IconX size={12} />}
          onClick={() => onChange('FAILED')}
        >
          Non retenu
        </Button>
      </Group>
    )
  }
  return null
}

/** Type proposé pour le tour suivant : celui qui suit le dernier tour dans la liste des types. */
function nextType(rounds: InterviewRound[], types: string[]) {
  const last = rounds.at(-1)
  if (!last) return types[0] ?? ''
  const i = types.indexOf(last.type)
  return i >= 0 && i + 1 < types.length ? types[i + 1] : ''
}

export function InterviewsCard({ o }: { o: OpportunityDetail }) {
  const { add, update, remove, reorder } = useInterviews(o.id)
  const { data: lists } = useRefLists()
  const [editingId, setEditingId] = useState<number | 'new' | null>(null)
  const rounds = o.interviews
  const progress = o.interviewProgress
  const currentIndex = rounds.findIndex((r) => r.status === 'PLANNED' || r.status === 'DONE')

  const setStatus = (r: InterviewRound) => (status: InterviewStatus) =>
    update.mutate({ id: r.id, status })

  const move = (index: number, delta: number) => {
    const ids = rounds.map((r) => r.id)
    const [moved] = ids.splice(index, 1)
    ids.splice(index + delta, 0, moved)
    reorder.mutate(ids)
  }

  const confirmRemove = (r: InterviewRound) =>
    modals.openConfirmModal({
      title: 'Supprimer cet entretien ?',
      children: <Text size="sm">« {roundTitle(r)} » sera retiré du processus.</Text>,
      labels: { confirm: 'Supprimer', cancel: 'Annuler' },
      confirmProps: { color: 'red' },
      onConfirm: () => remove.mutate(r.id),
    })

  return (
    <Card withBorder>
      <Group justify="space-between" mb={4} gap="xs" align="flex-start">
        <div>
          <Title order={4}>Processus de recrutement</Title>
          {progress && (
            <Text size="sm" c={progress.failed ? 'red.8' : 'dimmed'}>
              {progress.failed
                ? 'Non retenu'
                : `${progress.passed} entretien${progress.passed > 1 ? 's' : ''} validé${progress.passed > 1 ? 's' : ''} sur ${progress.total}`}
            </Text>
          )}
        </div>
        {editingId !== 'new' && (
          <Button
            size="xs"
            variant="light"
            leftSection={<IconPlus size={14} />}
            onClick={() => setEditingId('new')}
          >
            Ajouter un entretien
          </Button>
        )}
      </Group>

      {rounds.length === 0 && editingId !== 'new' && (
        <Text size="sm" c="dimmed" mt="xs">
          Aucun entretien pour l'instant. Ajoute les étapes du recrutement au fur et à mesure
          (échange client, entretien RH, technique, test…) pour suivre où tu en es.
        </Text>
      )}

      {rounds.length > 0 && (
        <Timeline bulletSize={26} lineWidth={2} mt="md">
          {rounds.map((r, index) => {
            const state = roundState(r)
            const info = ROUND_STATE_INFO[state]
            const StateIcon = info.icon
            const when = roundWhen(r)
            const isCurrent = index === currentIndex
            return (
              <Timeline.Item
                key={r.id}
                id={`round-${r.id}`}
                style={{ borderRadius: 'var(--mantine-radius-sm)' }}
                lineVariant={r.status === 'PASSED' ? 'solid' : 'dashed'}
                color={info.color}
                bullet={
                  <ThemeIcon
                    size={26}
                    radius="xl"
                    color={info.color}
                    variant={r.status === 'PLANNED' ? 'light' : 'filled'}
                  >
                    <StateIcon size={14} />
                  </ThemeIcon>
                }
                title={
                  editingId === r.id ? undefined : (
                    <Group justify="space-between" wrap="nowrap" gap="xs" align="flex-start">
                      <Text size="sm" fw={isCurrent ? 700 : 600} miw={0}>
                        {roundTitle(r)}
                      </Text>
                      <Group gap={4} wrap="nowrap">
                        <StatusMenu round={r} onChange={setStatus(r)} />
                        <Menu position="bottom-end" withinPortal>
                          <Menu.Target>
                            <ActionIcon
                              variant="subtle"
                              color="gray"
                              size="sm"
                              aria-label="Options de l'entretien"
                            >
                              <IconDots size={14} />
                            </ActionIcon>
                          </Menu.Target>
                          <Menu.Dropdown>
                            <Menu.Item
                              leftSection={<IconPencil size={14} />}
                              onClick={() => setEditingId(r.id)}
                            >
                              Modifier
                            </Menu.Item>
                            <Menu.Item
                              leftSection={<IconArrowUp size={14} />}
                              disabled={index === 0}
                              onClick={() => move(index, -1)}
                            >
                              Monter
                            </Menu.Item>
                            <Menu.Item
                              leftSection={<IconArrowDown size={14} />}
                              disabled={index === rounds.length - 1}
                              onClick={() => move(index, 1)}
                            >
                              Descendre
                            </Menu.Item>
                            <Menu.Item
                              color="red"
                              leftSection={<IconTrash size={14} />}
                              onClick={() => confirmRemove(r)}
                            >
                              Supprimer
                            </Menu.Item>
                          </Menu.Dropdown>
                        </Menu>
                      </Group>
                    </Group>
                  )
                }
              >
                {editingId === r.id ? (
                  <RoundForm
                    o={o}
                    initial={{
                      type: r.type,
                      label: r.label,
                      date: r.date,
                      time: r.time,
                      status: r.status,
                      notes: r.notes,
                      contactIds: r.contacts.map((c) => c.id),
                    }}
                    submitLabel="Enregistrer"
                    loading={update.isPending}
                    onCancel={() => setEditingId(null)}
                    onSubmit={(v) =>
                      update.mutate({ id: r.id, ...v }, { onSuccess: () => setEditingId(null) })
                    }
                  />
                ) : (
                  <Stack gap={4}>
                    <Text size="xs" c={state === 'OUTDATED' ? 'orange.8' : 'dimmed'}>
                      {when ?? 'Date à fixer'}
                      {state === 'OUTDATED' && ' · statut à mettre à jour'}
                    </Text>
                    <ContactNames contacts={r.contacts} />
                    {r.notes && (
                      <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
                        {r.notes}
                      </Text>
                    )}
                    {isCurrent && (
                      <QuickActions
                        round={r}
                        onChange={setStatus(r)}
                        onEdit={() => setEditingId(r.id)}
                      />
                    )}
                  </Stack>
                )}
              </Timeline.Item>
            )
          })}
        </Timeline>
      )}

      {editingId === 'new' && (
        <Card withBorder mt="md" padding="sm" bg="var(--mantine-color-default-hover)">
          <Text size="sm" fw={600} mb="xs">
            Nouvel entretien
          </Text>
          <RoundForm
            o={o}
            initial={{
              type: nextType(rounds, lists?.INTERVIEW_TYPE ?? []),
              label: null,
              date: null,
              time: null,
              status: 'PLANNED',
              notes: null,
              contactIds: [],
            }}
            submitLabel="Ajouter"
            loading={add.isPending}
            onCancel={() => setEditingId(null)}
            onSubmit={(v) => add.mutate(v, { onSuccess: () => setEditingId(null) })}
          />
        </Card>
      )}
    </Card>
  )
}
