import {
  ActionIcon,
  Alert,
  Anchor,
  Box,
  Card,
  Center,
  Badge,
  Group,
  Loader,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
  Tooltip,
} from '@mantine/core'
import {
  IconAlertTriangle,
  IconBriefcase,
  IconCalendarDue,
  IconCheck,
  IconClockPause,
  IconMessages,
  IconUsersGroup,
  type Icon,
} from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { api } from '../api.ts'
import { useCampaignSelection } from '../campaigns.ts'
import { DueBadge } from '../components/badges.tsx'
import { ClosedCampaignNotice } from '../components/CampaignSelect.tsx'
import {
  formatDay,
  isClosed,
  opportunityName,
  opportunitySubtitle,
  STALE_DAYS,
  today,
} from '../format.ts'
import { ContactNames } from '../components/ContactNames.tsx'
import { ROUND_STATE_INFO, roundState, roundTitle, roundWhen } from '../interviews.ts'
import { useNotificationMutations } from '../notifications.ts'
import type { Day, InterviewRound, OpportunitySummary, Stage } from '../types.ts'

type OpportunityRef = Pick<
  OpportunitySummary,
  'id' | 'reference' | 'title' | 'stage' | 'company' | 'intermediary'
>

type Dashboard = {
  byStage: (Stage & { count: number })[]
  kpis: {
    total: number
    active: number
    overdue: number
    dueToday: number
    stale: number
    interviews: number
    contactsLastWeek: number
    upcomingInterviews: number
  }
  interviews: Record<'upcoming' | 'toSchedule' | 'awaiting', DashboardRound[]>
  todo: { id: number; label: string; dueDate: Day; opportunity: OpportunityRef }[]
  stale: { opportunity: OpportunityRef; lastContactAt: Day }[]
  recent: {
    id: number
    date: Day
    channel: string | null
    summary: string
    opportunity: OpportunityRef
  }[]
}

type DashboardRound = Omit<InterviewRound, 'notes'> & { opportunity: OpportunityRef }

const useDashboard = (campaignId: number | undefined, enabled: boolean) =>
  useQuery({
    queryKey: ['dashboard', campaignId ?? 'all'],
    queryFn: () => api.get<Dashboard>(`/dashboard${campaignId ? `?campaignId=${campaignId}` : ''}`),
    enabled,
  })

const daysSince = (day: Day) => Math.round((Date.parse(today()) - Date.parse(day)) / 86_400_000)

/** Chiffre clé ; l'icône et le libellé portent le sens, pas la couleur seule. */
function Kpi({
  value,
  label,
  icon: KpiIcon,
  color,
  to,
  title,
}: {
  value: number
  label: string
  /** Explication au survol. */
  title?: string
  icon: Icon
  color: string
  to?: string
}) {
  const alert = value > 0 && (color === 'red' || color === 'orange')
  const body = (
    <Card withBorder padding="sm" h="100%">
      <Group gap="sm" wrap="nowrap" align="flex-start" title={title}>
        <ThemeIcon variant="light" color={value > 0 ? color : 'gray'} size="lg">
          <KpiIcon size={20} />
        </ThemeIcon>
        <div>
          <Text fw={700} fz={28} lh={1} c={alert ? `${color}.8` : undefined}>
            {value}
          </Text>
          <Text size="sm" c="dimmed" mt={4} style={{ whiteSpace: 'nowrap' }}>
            {label}
          </Text>
        </div>
      </Group>
    </Card>
  )
  return to ? (
    <Anchor component={Link} to={to} underline="never" c="inherit">
      {body}
    </Anchor>
  ) : (
    body
  )
}

function Section({
  title,
  count,
  children,
}: {
  title: string
  count?: number
  children: ReactNode
}) {
  return (
    <Card withBorder>
      <Group justify="space-between" mb="sm">
        <Title order={4}>{title}</Title>
        {count !== undefined && (
          <Text size="sm" c="dimmed">
            {count}
          </Text>
        )}
      </Group>
      {children}
    </Card>
  )
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <Text size="sm" c="dimmed" fs="italic">
      {children}
    </Text>
  )
}

/** Nom de la piste (lien) et ligne secondaire. */
function OpportunityLink({ o }: { o: OpportunityRef }) {
  const subtitle = opportunitySubtitle(o)
  return (
    <Box miw={0}>
      <Anchor component={Link} to={`/pistes/${o.id}`} size="sm" fw={500} lineClamp={1}>
        {opportunityName(o)}
      </Anchor>
      {subtitle && (
        <Text size="xs" c="dimmed" lineClamp={1}>
          {subtitle}
        </Text>
      )}
    </Box>
  )
}

function TodoList({ items }: { items: Dashboard['todo'] }) {
  const { completeAction } = useNotificationMutations()
  if (!items.length) return <Empty>Aucune action dans les 7 prochains jours.</Empty>
  return (
    <Stack gap="sm">
      {items.map((a) => (
        <Group key={a.id} gap="sm" wrap="nowrap" align="flex-start">
          <Tooltip label="Marquer comme faite">
            <ActionIcon
              variant="default"
              radius="xl"
              aria-label={`Marquer « ${a.label} » comme faite`}
              loading={completeAction.isPending && completeAction.variables === a.id}
              onClick={() => completeAction.mutate(a.id)}
            >
              <IconCheck size={14} />
            </ActionIcon>
          </Tooltip>
          <Box style={{ flex: 1 }} miw={0}>
            <Group gap={6} wrap="nowrap">
              <DueBadge dueDate={a.dueDate} />
              <Text size="sm" lineClamp={2}>
                {a.label}
              </Text>
            </Group>
            <OpportunityLink o={a.opportunity} />
          </Box>
        </Group>
      ))}
    </Stack>
  )
}

function StaleList({ items }: { items: Dashboard['stale'] }) {
  if (!items.length) return <Empty>Toutes les pistes actives ont eu un échange récent.</Empty>
  return (
    <Stack gap="sm">
      {items.map(({ opportunity, lastContactAt }) => (
        <Group key={opportunity.id} justify="space-between" wrap="nowrap">
          <OpportunityLink o={opportunity} />
          <Text size="sm" c="red.8" style={{ flexShrink: 0 }}>
            {daysSince(lastContactAt)} j
          </Text>
        </Group>
      ))}
    </Stack>
  )
}

/**
 * Pistes par étape : barres horizontales d'une seule teinte (une seule série),
 * étapes clôturées en gris. Valeur écrite à côté de chaque barre, détail au survol.
 */
function StageFunnel({ byStage, total }: { byStage: Dashboard['byStage']; total: number }) {
  const max = Math.max(1, ...byStage.map((s) => s.count))
  return (
    <Stack gap={6} role="list" aria-label="Pistes par étape">
      {byStage.map((stage) => {
        const n = stage.count
        const closed = isClosed(stage)
        const share = total ? Math.round((n / total) * 100) : 0
        return (
          <Tooltip
            key={stage.id}
            label={`${stage.label} : ${n} piste${n > 1 ? 's' : ''} (${share} %)`}
            position="top-start"
          >
            <Group gap="sm" wrap="nowrap" role="listitem" style={{ cursor: 'default' }}>
              <Text
                size="sm"
                w={130}
                lineClamp={1}
                style={{ flexShrink: 0 }}
                c={closed ? 'dimmed' : undefined}
              >
                {stage.label}
              </Text>
              <Box style={{ flex: 1 }} h={16}>
                {n > 0 && (
                  <Box
                    h="100%"
                    w={`${(n / max) * 100}%`}
                    miw={4}
                    bg={closed ? 'gray.4' : 'blue.6'}
                    style={{ borderRadius: '0 4px 4px 0' }}
                  />
                )}
              </Box>
              <Text size="sm" w={24} ta="right" fw={500} c={n ? undefined : 'dimmed'}>
                {n}
              </Text>
            </Group>
          </Tooltip>
        )
      })}
    </Stack>
  )
}

function RoundRow({ r }: { r: DashboardRound }) {
  const state = roundState(r)
  const info = ROUND_STATE_INFO[state]
  // Le groupe dit déjà le statut : on n'affiche que la date utile.
  const aside =
    state === 'UPCOMING' ? (
      <Badge
        color={info.color}
        variant={r.date === today() ? 'filled' : 'light'}
        style={{ flexShrink: 0 }}
      >
        {roundWhen(r)}
      </Badge>
    ) : state === 'OUTDATED' ? (
      <Badge color={info.color} variant="light" style={{ flexShrink: 0 }}>
        {info.label}
      </Badge>
    ) : r.status === 'DONE' && r.date ? (
      <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>
        depuis {daysSince(r.date)} j
      </Text>
    ) : null
  return (
    <Group justify="space-between" wrap="nowrap" align="flex-start" gap="sm">
      <Box miw={0}>
        <Text size="sm" fw={500} lineClamp={1}>
          {roundTitle(r)}
        </Text>
        <OpportunityLink o={r.opportunity} />
        <ContactNames contacts={r.contacts} size="xs" lineClamp={1} />
      </Box>
      {aside}
    </Group>
  )
}

/** Tours non tranchés des pistes actives : à venir, sans date, en attente de retour. */
function InterviewList({ interviews }: { interviews: Dashboard['interviews'] }) {
  const groups = [
    { title: 'À venir', items: interviews.upcoming },
    { title: 'En attente du retour', items: interviews.awaiting },
    { title: 'À planifier', items: interviews.toSchedule },
  ].filter((g) => g.items.length)
  if (!groups.length) {
    return <Empty>Aucun entretien en cours. Ajoute-les depuis la fiche d'une piste.</Empty>
  }
  return (
    <Stack gap="md">
      {groups.map((g) => (
        <Stack key={g.title} gap="sm">
          <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
            {g.title}
          </Text>
          {g.items.map((r) => (
            <RoundRow key={r.id} r={r} />
          ))}
        </Stack>
      ))}
    </Stack>
  )
}

function RecentList({ items }: { items: Dashboard['recent'] }) {
  if (!items.length) return <Empty>Aucun échange enregistré.</Empty>
  return (
    <Stack gap="sm">
      {items.map((i) => (
        <Box key={i.id}>
          <Group justify="space-between" wrap="nowrap" align="flex-start">
            <OpportunityLink o={i.opportunity} />
            <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>
              {formatDay(i.date)}
              {i.channel ? ` · ${i.channel}` : ''}
            </Text>
          </Group>
          <Text size="sm" lineClamp={2} mt={2}>
            {i.summary}
          </Text>
        </Box>
      ))}
    </Stack>
  )
}

export function DashboardPage() {
  const { selected, isPending: campaignsPending, campaigns } = useCampaignSelection()
  const { data, isPending, isError, error } = useDashboard(selected?.id, !campaignsPending)

  const since = selected ? daysSince(selected.startDate) : null

  return (
    <Stack>
      <div>
        <Title order={2}>Tableau de bord</Title>
        <Text c="dimmed" size="sm">
          {selected
            ? `${selected.name} · ${
                selected.endDate
                  ? `du ${formatDay(selected.startDate)} au ${formatDay(selected.endDate)}`
                  : `depuis ${since} jour${since === 1 ? '' : 's'}`
              }`
            : 'Toutes les campagnes'}
        </Text>
        {selected?.goal && (
          <Text size="sm" mt={4} style={{ whiteSpace: 'pre-line' }}>
            {selected.goal}
          </Text>
        )}
      </div>

      <ClosedCampaignNotice />

      {!campaignsPending && campaigns.length === 0 ? (
        <Alert color="blue" title="Aucune campagne">
          <Anchor component={Link} to="/campagnes">
            Crée une première campagne
          </Anchor>{' '}
          pour commencer à suivre tes pistes.
        </Alert>
      ) : isPending ? (
        <Center p="xl">
          <Loader />
        </Center>
      ) : isError ? (
        <Alert color="red" title="Impossible de charger le tableau de bord">
          {error.message}
        </Alert>
      ) : (
        <>
          <SimpleGrid cols={{ base: 2, sm: 3, lg: 6 }} spacing="sm">
            <Kpi
              value={data.kpis.active}
              label={`active${data.kpis.active > 1 ? 's' : ''} sur ${data.kpis.total}`}
              icon={IconBriefcase}
              color="blue"
              to="/pistes"
            />
            <Kpi value={data.kpis.overdue} label="en retard" icon={IconAlertTriangle} color="red" />
            <Kpi
              value={data.kpis.dueToday}
              label="aujourd'hui"
              icon={IconCalendarDue}
              color="orange"
            />
            <Kpi
              value={data.kpis.stale}
              label="à relancer"
              icon={IconClockPause}
              color="gray"
              title={`Pistes actives sans échange depuis plus de ${STALE_DAYS} jours`}
            />
            <Kpi
              value={data.kpis.upcomingInterviews}
              label="entretiens"
              icon={IconUsersGroup}
              title={`Entretiens à venir (date fixée) · ${data.kpis.interviews} piste${data.kpis.interviews > 1 ? 's' : ''} à une étape avancée`}
              color="violet"
              to="/pipeline"
            />
            <Kpi
              value={data.kpis.contactsLastWeek}
              label="échanges 7 j"
              icon={IconMessages}
              color="teal"
            />
          </SimpleGrid>

          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
            <Stack>
              <Section
                title="Entretiens"
                count={
                  data.interviews.upcoming.length +
                  data.interviews.awaiting.length +
                  data.interviews.toSchedule.length
                }
              >
                <InterviewList interviews={data.interviews} />
              </Section>
              <Section title="À faire" count={data.todo.length}>
                <TodoList items={data.todo} />
              </Section>
              <Section title="À relancer" count={data.stale.length}>
                <StaleList items={data.stale} />
              </Section>
            </Stack>
            <Stack>
              <Section title="Pistes par étape" count={data.kpis.total}>
                <StageFunnel byStage={data.byStage} total={data.kpis.total} />
              </Section>
              <Section title="Derniers échanges">
                <RecentList items={data.recent} />
              </Section>
            </Stack>
          </SimpleGrid>
        </>
      )}
    </Stack>
  )
}
