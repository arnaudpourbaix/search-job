import { Badge, Group, Text, Tooltip } from '@mantine/core'
import { IconAlertTriangle, IconCopy } from '@tabler/icons-react'
import { DUE_COLORS, dueStatus, formatDay } from '../format.ts'
import { useStaleDays } from '../followUp.ts'
import type { NextAction, Stage } from '../types.ts'

export function StageBadge({ stage }: { stage: Stage }) {
  return (
    <Badge color={stage.color} variant="light">
      {stage.label}
    </Badge>
  )
}

/** Échéance colorée : rouge = dépassée, orange = aujourd'hui, jaune = sous 7 jours. */
export function DueBadge({ dueDate }: { dueDate: string | null }) {
  const status = dueStatus(dueDate)
  if (status === 'none') return null
  return (
    <Badge
      color={DUE_COLORS[status]}
      variant={status === 'overdue' || status === 'today' ? 'filled' : 'light'}
      size="sm"
      style={{ flexShrink: 0 }}
    >
      {status === 'today' ? "Aujourd'hui" : formatDay(dueDate)}
    </Badge>
  )
}

export function NextActionCell({ action }: { action: NextAction | null }) {
  if (!action) return <Text c="dimmed">—</Text>
  return (
    <Group gap={6} wrap="nowrap">
      <DueBadge dueDate={action.dueDate} />
      <Text size="sm" lineClamp={1}>
        {action.label}
      </Text>
    </Group>
  )
}

export function StaleIcon() {
  const staleDays = useStaleDays()
  return (
    <Tooltip label={`À relancer : pas de contact depuis plus de ${staleDays} jours`}>
      <IconAlertTriangle size={16} color="var(--mantine-color-red-6)" />
    </Tooltip>
  )
}

export function DuplicateCompanyIcon() {
  return (
    <Tooltip label="Cette entreprise est proposée sur plusieurs pistes : attention aux doubles présentations">
      <IconCopy size={16} color="var(--mantine-color-yellow-7)" />
    </Tooltip>
  )
}
