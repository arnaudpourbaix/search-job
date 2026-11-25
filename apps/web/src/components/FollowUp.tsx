import {
  ActionIcon,
  Badge,
  Button,
  Center,
  Loader,
  Menu,
  Modal,
  Text,
  Tooltip,
} from '@mantine/core'
import { IconBellPause, IconChevronDown, IconX } from '@tabler/icons-react'
import { addDays, formatDay, isSnoozed, isStale, today } from '../format.ts'
import { SNOOZE_CHOICES, useSnooze, useStaleDays } from '../followUp.ts'
import { useJournal, useOpportunity } from '../queries.ts'
import type { OpportunitySummary } from '../types.ts'
import { StaleIcon } from './badges.tsx'
import { InteractionForm } from './InteractionForm.tsx'

/** Menu « Reporter » : la piste sort de « à relancer » pendant la durée choisie. */
export function SnoozeMenu({ opportunityId }: { opportunityId: number }) {
  const snooze = useSnooze()
  return (
    <Menu position="bottom-end" withinPortal>
      <Menu.Target>
        <Button
          size="compact-xs"
          variant="subtle"
          color="gray"
          leftSection={<IconBellPause size={14} />}
          rightSection={<IconChevronDown size={12} />}
          loading={snooze.isPending}
        >
          Reporter
        </Button>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>Ne plus signaler pendant…</Menu.Label>
        {SNOOZE_CHOICES.map((c) => (
          <Menu.Item
            key={c.days}
            onClick={() => snooze.mutate({ id: opportunityId, until: addDays(today(), c.days) })}
          >
            {c.label}
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  )
}

/** Relance reportée : date de fin, et bouton pour annuler le report. */
function SnoozedBadge({ o }: { o: Pick<OpportunitySummary, 'id' | 'snoozedUntil'> }) {
  const snooze = useSnooze()
  return (
    <Badge
      variant="light"
      color="gray"
      leftSection={<IconBellPause size={12} />}
      tt="none"
      rightSection={
        <Tooltip label="Annuler le report">
          <ActionIcon
            size="xs"
            variant="transparent"
            color="gray"
            aria-label="Annuler le report de la relance"
            loading={snooze.isPending}
            onClick={() => snooze.mutate({ id: o.id, until: null })}
          >
            <IconX size={12} />
          </ActionIcon>
        </Tooltip>
      }
    >
      Relance reportée au {formatDay(o.snoozedUntil)}
    </Badge>
  )
}

/** Sur la fiche : alerte « à relancer » avec « Reporter », ou relance reportée. */
export function FollowUpStatus({
  o,
}: {
  o: Pick<OpportunitySummary, 'id' | 'stage' | 'lastContactAt' | 'nextInterviewAt' | 'snoozedUntil'>
}) {
  const staleDays = useStaleDays()
  if (isSnoozed(o)) return <SnoozedBadge o={o} />
  if (!isStale(o, staleDays)) return null
  return (
    <>
      <StaleIcon />
      <SnoozeMenu opportunityId={o.id} />
    </>
  )
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
      initial={{ date: today(), channel: null, summary: 'Relance', contactId: null }}
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
