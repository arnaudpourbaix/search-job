import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Card,
  Center,
  Group,
  Loader,
  Menu,
  ScrollArea,
  Stack,
  Switch,
  Text,
  Title,
} from '@mantine/core'
import { useLocalStorage, useMediaQuery } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { IconArrowsRightLeft, IconDotsVertical } from '@tabler/icons-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type DragEvent } from 'react'
import { useNavigate } from 'react-router'
import { api } from '../api.ts'
import { NextActionCell } from '../components/badges.tsx'
import { InterviewSteps } from '../components/InterviewSteps.tsx'
import { LastContact, OpportunityName } from '../components/OpportunityParts.tsx'
import { formatPay, isClosed, opportunityName, rowBackground } from '../format.ts'
import { useCampaignSelection } from '../campaigns.ts'
import { ClosedCampaignNotice } from '../components/CampaignSelect.tsx'
import { useOpportunities } from '../queries.ts'
import { useStages } from '../settings.ts'
import type { OpportunitySummary, Stage } from '../types.ts'

const DRAG_TYPE = 'application/x-opportunity-id'

/** Échéance la plus proche d'abord, sans action en dernier. */
function byUrgency(a: OpportunitySummary, b: OpportunitySummary) {
  const da = a.nextAction?.dueDate ?? '9999'
  const db = b.nextAction?.dueDate ?? '9999'
  return da.localeCompare(db) || b.updatedAt.localeCompare(a.updatedAt)
}

/** Changement d'étape, affiché immédiatement dans toutes les listes en cache. */
function useMoveStage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ o, stage }: { o: OpportunitySummary; stage: Stage }) =>
      api.patch(`/opportunities/${o.id}`, { stageId: stage.id }),
    onMutate: async ({ o, stage }) => {
      await qc.cancelQueries({ queryKey: ['opportunities'] })
      const previous = qc.getQueriesData<OpportunitySummary[]>({ queryKey: ['opportunities'] })
      qc.setQueriesData<OpportunitySummary[]>({ queryKey: ['opportunities'] }, (list) =>
        list?.map((x) => (x.id === o.id ? { ...x, stage } : x)),
      )
      return { previous }
    },
    onError: (_e, _v, context) => {
      context?.previous.forEach(([key, data]) => qc.setQueryData(key, data))
    },
    onSuccess: (_d, { o, stage }) =>
      notifications.show({
        message: `${opportunityName(o)} → ${stage.label}`,
      }),
    onSettled: (_d, _e, { o }) => {
      void qc.invalidateQueries({ queryKey: ['opportunities'] })
      void qc.invalidateQueries({ queryKey: ['opportunity', o.id] })
    },
  })
}

function PipelineCard({
  o,
  stages,
  onMove,
  showCampaign,
}: {
  o: OpportunitySummary
  stages: Stage[]
  onMove: (stage: Stage) => void
  showCampaign: boolean
}) {
  const navigate = useNavigate()
  const [dragging, setDragging] = useState(false)
  const pay = formatPay(o)

  return (
    <Card
      withBorder
      padding="sm"
      draggable
      onDragStart={(e: DragEvent) => {
        e.dataTransfer.setData(DRAG_TYPE, String(o.id))
        e.dataTransfer.effectAllowed = 'move'
        setDragging(true)
      }}
      onDragEnd={() => setDragging(false)}
      onClick={() => void navigate(`/pistes/${o.id}`)}
      style={{
        cursor: 'grab',
        background: rowBackground(o),
        opacity: dragging ? 0.4 : 1,
      }}
    >
      <Group justify="space-between" wrap="nowrap" align="flex-start" gap={4}>
        <OpportunityName o={o} showCampaign={showCampaign} />
        <Menu position="bottom-end" withinPortal>
          <Menu.Target>
            <ActionIcon
              variant="subtle"
              color="gray"
              size="sm"
              aria-label="Déplacer vers…"
              onClick={(e) => e.stopPropagation()}
            >
              <IconDotsVertical size={16} />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown onClick={(e) => e.stopPropagation()}>
            <Menu.Label>Déplacer vers</Menu.Label>
            {stages
              .filter((s) => s.id !== o.stage.id)
              .map((s) => (
              <Menu.Item
                key={s.id}
                leftSection={<IconArrowsRightLeft size={14} />}
                c={s.color === 'gray' ? undefined : `${s.color}.7`}
                onClick={() => onMove(s)}
              >
                {s.label}
              </Menu.Item>
            ))}
          </Menu.Dropdown>
        </Menu>
      </Group>
      {(o.title || pay) && (
        <Text size="sm" mt={4} lineClamp={2}>
          {[o.title, pay].filter(Boolean).join(' · ')}
        </Text>
      )}
      {o.interviews && (
        <Box mt={8}>
          <InterviewSteps progress={o.interviews} />
        </Box>
      )}
      {o.nextAction && (
        <Box mt={6}>
          <NextActionCell action={o.nextAction} />
        </Box>
      )}
      <Group justify="space-between" mt={6} gap={4}>
        <Text size="xs" c="dimmed">
          Dernier contact
        </Text>
        <LastContact o={o} />
      </Group>
    </Card>
  )
}

function Column({
  stage,
  stages,
  items,
  onDropId,
  onMove,
  stacked,
  showCampaign,
}: {
  stage: Stage
  /** Toutes les étapes, pour le menu « Déplacer vers ». */
  stages: Stage[]
  stacked: boolean
  showCampaign: boolean
  items: OpportunitySummary[]
  onDropId: (id: number) => void
  onMove: (o: OpportunitySummary, stage: Stage) => void
}) {
  const [over, setOver] = useState(false)
  const color = stage.color

  return (
    <Stack
      gap="xs"
      p="xs"
      w={stacked ? '100%' : 280}
      style={{
        flexShrink: 0,
        borderRadius: 'var(--mantine-radius-md)',
        borderTop: `3px solid var(--mantine-color-${color}-6)`,
        background: over ? `var(--mantine-color-${color}-light)` : 'var(--mantine-color-default-hover)',
        outline: over ? `2px dashed var(--mantine-color-${color}-5)` : undefined,
        transition: 'background 120ms',
        minHeight: stacked ? undefined : 200,
      }}
      onDragOver={(e: DragEvent) => {
        if (!e.dataTransfer.types.includes(DRAG_TYPE)) return
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        setOver(true)
      }}
      onDragLeave={(e: DragEvent) => {
        // Ignore les passages d'une carte enfant à l'autre.
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false)
      }}
      onDrop={(e: DragEvent) => {
        e.preventDefault()
        setOver(false)
        const id = Number(e.dataTransfer.getData(DRAG_TYPE))
        if (id) onDropId(id)
      }}
    >
      <Group justify="space-between" px={4}>
        <Text fw={600} size="sm" tt="uppercase" c={`${color}.8`}>
          {stage.label}
        </Text>
        <Badge variant="light" color={color} size="sm" circle>
          {items.length}
        </Badge>
      </Group>
      {items.map((o) => (
        <PipelineCard
          key={o.id}
          o={o}
          stages={stages}
          showCampaign={showCampaign}
          onMove={(s) => onMove(o, s)}
        />
      ))}
      {items.length === 0 && !stacked && (
        <Text size="xs" c="dimmed" ta="center" py="md">
          Glisser une piste ici
        </Text>
      )}
    </Stack>
  )
}

export function PipelinePage() {
  const { selected, isPending: campaignsPending } = useCampaignSelection()
  const { data, isPending, isError, error } = useOpportunities(
    { campaignId: selected?.id },
    !campaignsPending,
  )
  const move = useMoveStage()
  const [showClosed, setShowClosed] = useLocalStorage({
    key: 'pipeline-show-closed',
    defaultValue: false,
  })

  // Téléphone : colonnes empilées (le glisser-déposer n'y fonctionne pas, menu « Déplacer vers »).
  const stacked = useMediaQuery('(max-width: 48em)') ?? false
  const { data: allStages = [] } = useStages()
  const visibleStages = allStages.filter((s) => showClosed || !isClosed(s))
  const moveTo = (o: OpportunitySummary, stage: Stage) => {
    if (o.stage.id !== stage.id) move.mutate({ o, stage })
  }
  const columns = (items: OpportunitySummary[]) =>
    visibleStages.map((stage) => (
      <Column
        key={stage.id}
        stage={stage}
        stages={allStages}
        stacked={stacked}
        showCampaign={!selected}
        items={items.filter((o) => o.stage.id === stage.id).sort(byUrgency)}
        onDropId={(id) => {
          const o = items.find((x) => x.id === id)
          if (o) moveTo(o, stage)
        }}
        onMove={moveTo}
      />
    ))

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={2}>Pipeline</Title>
        <Switch
          label="Afficher les pistes clôturées"
          checked={showClosed}
          onChange={(e) => setShowClosed(e.currentTarget.checked)}
        />
      </Group>

      <ClosedCampaignNotice />

      {isPending ? (
        <Center p="xl">
          <Loader />
        </Center>
      ) : isError ? (
        <Alert color="red" title="Impossible de charger les pistes">
          {error.message}
        </Alert>
      ) : stacked ? (
        <Stack gap="sm">{columns(data)}</Stack>
      ) : (
        <ScrollArea type="auto" offsetScrollbars="x">
          <Group gap="sm" align="flex-start" wrap="nowrap" pb="xs">
            {columns(data)}
          </Group>
        </ScrollArea>
      )}
    </Stack>
  )
}
