import {
  ActionIcon,
  Badge,
  Button,
  Center,
  Group,
  Loader,
  Menu,
  Modal,
  Text,
  Tooltip,
} from '@mantine/core'
import {
  IconBellPause,
  IconBellRinging,
  IconCalendarEvent,
  IconChevronDown,
  IconHourglass,
  IconHourglassOff,
  IconX,
} from '@tabler/icons-react'
import { useState } from 'react'
import { addDays, formatDay, today } from '../format.ts'
import { noResponseText, SNOOZE_CHOICES, useFollowUpDates, useStaleDays } from '../followUp.ts'
import { useJournal, useOpportunity } from '../queries.ts'
import type { Day, NoResponseReason, OpportunitySummary } from '../types.ts'
import { StaleIcon } from './badges.tsx'
import { ClosePrompt } from './ClosePrompt.tsx'
import { InteractionForm } from './InteractionForm.tsx'

/**
 * Menu « Reporter » : fixe la date de relance de la piste (elle sort de « à relancer »
 * jusque-là), ou la rend de nouveau calculée.
 */
export function SnoozeMenu({
  opportunityId,
  planned = false,
  label = 'Reporter',
}: {
  opportunityId: number
  /** La date actuelle a été saisie : proposer de revenir au calcul. */
  planned?: boolean
  label?: string
}) {
  const dates = useFollowUpDates()
  const staleDays = useStaleDays()
  return (
    <Menu position="bottom-end" withinPortal>
      <Menu.Target>
        <Button
          size="compact-xs"
          variant="subtle"
          color="gray"
          leftSection={<IconBellPause size={14} />}
          rightSection={<IconChevronDown size={12} />}
          loading={dates.isPending}
        >
          {label}
        </Button>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>Relancer dans…</Menu.Label>
        {SNOOZE_CHOICES.map((c) => (
          <Menu.Item
            key={c.days}
            onClick={() =>
              dates.mutate({ id: opportunityId, followUpAt: addDays(today(), c.days) })
            }
          >
            {c.label}
          </Menu.Item>
        ))}
        {planned && (
          <>
            <Menu.Divider />
            <Menu.Item onClick={() => dates.mutate({ id: opportunityId, followUpAt: null })}>
              Revenir au délai de relance ({staleDays} j après le dernier contact)
            </Menu.Item>
          </>
        )}
      </Menu.Dropdown>
    </Menu>
  )
}

/**
 * Menu « Toujours en attente » d'une piste sans réponse. Délai annoncé dépassé : le
 * repousse, ou le retire. Long silence : fixe une date de relance (attendre jusque-là).
 */
export function StillWaitingMenu({
  opportunityId,
  reason,
}: {
  opportunityId: number
  reason: NoResponseReason
}) {
  const dates = useFollowUpDates()
  const field = reason === 'DEADLINE' ? 'responseDueAt' : 'followUpAt'
  return (
    <Menu position="bottom-end" withinPortal>
      <Menu.Target>
        <Button
          size="compact-xs"
          variant="subtle"
          color="gray"
          rightSection={<IconChevronDown size={12} />}
          loading={dates.isPending}
        >
          Toujours en attente
        </Button>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>Attendre encore…</Menu.Label>
        {SNOOZE_CHOICES.map((c) => (
          <Menu.Item
            key={c.days}
            onClick={() => dates.mutate({ id: opportunityId, [field]: addDays(today(), c.days) })}
          >
            {c.label}
          </Menu.Item>
        ))}
        {reason === 'DEADLINE' && (
          <>
            <Menu.Divider />
            <Menu.Item onClick={() => dates.mutate({ id: opportunityId, responseDueAt: null })}>
              Retirer le délai (relances habituelles)
            </Menu.Item>
          </>
        )}
      </Menu.Dropdown>
    </Menu>
  )
}

/** Bouton « Clore… » d'une piste restée sans réponse : « Sans suite » présélectionnée. */
export function CloseNoResponseButton({
  opportunityId,
  reason,
  date,
}: {
  opportunityId: number
  reason: NoResponseReason
  date: Day
}) {
  const [opened, setOpened] = useState(false)
  return (
    <>
      <Button size="compact-xs" variant="light" color="red" onClick={() => setOpened(true)}>
        Clore…
      </Button>
      <ClosePrompt
        opportunityId={opportunityId}
        prefer="Sans suite"
        opened={opened}
        onClose={() => setOpened(false)}
      >
        {noResponseText(reason, date)} : la candidature peut être considérée comme sans suite.
      </ClosePrompt>
    </>
  )
}

/** Sur la fiche : où en est la relance (prévue, à faire, en attente de réponse…). */
export function FollowUpStatus({
  o,
}: {
  o: Pick<OpportunitySummary, 'id' | 'followUp' | 'nextInterviewAt'>
}) {
  const staleDays = useStaleDays()
  const dates = useFollowUpDates()
  const { status, date, planned, reason } = o.followUp
  const badge = { variant: 'light', tt: 'none' } as const

  switch (status) {
    case 'NONE':
      return null
    case 'INTERVIEW':
      return (
        <Tooltip label="Un entretien est prévu : pas de relance d'ici là">
          <Badge {...badge} color="gray" leftSection={<IconCalendarEvent size={12} />}>
            Entretien le {formatDay(o.nextInterviewAt)}
          </Badge>
        </Tooltip>
      )
    case 'AWAITING':
      return (
        <Badge
          {...badge}
          color="blue"
          leftSection={<IconHourglass size={12} />}
          rightSection={
            <Tooltip label="Retirer le délai de réponse">
              <ActionIcon
                size="xs"
                variant="transparent"
                color="gray"
                aria-label="Retirer le délai de réponse"
                loading={dates.isPending}
                onClick={() => dates.mutate({ id: o.id, responseDueAt: null })}
              >
                <IconX size={12} />
              </ActionIcon>
            </Tooltip>
          }
        >
          Réponse attendue d'ici le {formatDay(date)}
        </Badge>
      )
    case 'NO_RESPONSE':
      return (
        <Group gap={4} wrap="nowrap">
          <Tooltip label={noResponseText(reason!, date!)}>
            <Badge {...badge} color="orange" leftSection={<IconHourglassOff size={12} />}>
              {reason === 'DEADLINE'
                ? `Sans réponse au ${formatDay(date)}`
                : `Aucune réponse depuis le ${formatDay(date)}`}
            </Badge>
          </Tooltip>
          <CloseNoResponseButton opportunityId={o.id} reason={reason!} date={date!} />
          <StillWaitingMenu opportunityId={o.id} reason={reason!} />
        </Group>
      )
    case 'PLANNED':
      return (
        <Group gap={4} wrap="nowrap">
          <Tooltip
            label={
              planned
                ? 'Date de relance fixée sur la piste'
                : `Dernier contact + ${staleDays} jours (délai réglable dans les paramètres)`
            }
          >
            <Badge {...badge} color="gray" leftSection={<IconBellRinging size={12} />}>
              Relance le {formatDay(date)}
            </Badge>
          </Tooltip>
          <SnoozeMenu opportunityId={o.id} planned={planned} label="Changer" />
        </Group>
      )
    case 'DUE':
      return (
        <Group gap={4} wrap="nowrap">
          <StaleIcon since={date} />
          <Text size="sm" c="red.8">
            À relancer depuis le {formatDay(date)}
          </Text>
          <SnoozeMenu opportunityId={o.id} planned={planned} />
        </Group>
      )
  }
}

/** Saisie de la relance (un échange du journal), sans quitter le tableau de bord. */
function FollowUpForm({ opportunityId, onDone }: { opportunityId: number; onDone: () => void }) {
  const { data: o, isPending } = useOpportunity(opportunityId)
  const { addInteraction } = useJournal(opportunityId)
  if (isPending || !o) {
    return (
      <Center p="md">
        <Loader size="sm" />
      </Center>
    )
  }
  return (
    <InteractionForm
      o={o}
      initial={{
        date: today(),
        channel: null,
        summary: 'Relance',
        contactId: null,
        // Le plus souvent, une relance reste d'abord sans réponse : à décocher sinon.
        answered: false,
      }}
      submitLabel="Enregistrer la relance"
      loading={addInteraction.isPending}
      onCancel={onDone}
      onSubmit={(v) => addInteraction.mutate(v, { onSuccess: onDone })}
    />
  )
}

/** Fenêtre « Noter une relance » : l'échange noté sort la piste de « à relancer ». */
export function FollowUpModal({
  opportunityId,
  name,
  onClose,
}: {
  opportunityId: number | null
  name: string
  onClose: () => void
}) {
  return (
    <Modal opened={opportunityId !== null} onClose={onClose} title={`Noter une relance · ${name}`}>
      <Text size="sm" c="dimmed" mb="sm">
        Enregistre dans le journal la relance que tu as faite (mail, appel, message…). Rien n'est
        envoyé : l'échange compte comme un nouveau contact et la piste sort de « À relancer ».
      </Text>
      {opportunityId !== null && <FollowUpForm opportunityId={opportunityId} onDone={onClose} />}
    </Modal>
  )
}
