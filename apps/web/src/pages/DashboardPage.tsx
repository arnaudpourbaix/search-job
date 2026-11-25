import {
  ActionIcon,
  Alert,
  Anchor,
  Box,
  Button,
  Card,
  Center,
  ColorSwatch,
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
  IconPencilPlus,
  IconUsersGroup,
  type Icon,
} from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { api } from '../api.ts'
import { useCampaignSelection } from '../campaigns.ts'
import { DueBadge } from '../components/badges.tsx'
import { ClosedCampaignNotice } from '../components/CampaignSelect.tsx'
import {
  CloseNoResponseButton,
  FollowUpModal,
  SnoozeMenu,
  StillWaitingMenu,
} from '../components/FollowUp.tsx'
import { formatDay, isClosed, opportunityName, opportunitySubtitle, today } from '../format.ts'
import { ContactNames } from '../components/ContactNames.tsx'
import { ROUND_STATE_INFO, roundState, roundTitle, roundWhen } from '../interviews.ts'
import { noResponseText } from '../followUp.ts'
import { useNotificationMutations } from '../notifications.ts'
import type { Day, InterviewRound, NoResponseReason, OpportunitySummary, Stage } from '../types.ts'

type OpportunityRef = Pick<
  OpportunitySummary,
  'id' | 'reference' | 'title' | 'stage' | 'company' | 'intermediary'
>

type Dashboard = {
  /** Délai de relance de l'utilisateur (jours sans contact). */
  staleDays: number
  byStage: (Stage & { count: number })[]
  kpis: {
    total: number
    active: number
    overdue: number
    dueToday: number
    stale: number
    /** Délai de réponse dépassé sans nouvelles : clôture proposée. */
    noResponse: number
    interviews: number
    contactsLastWeek: number
    upcomingInterviews: number
    /** Entretiens non tranchés : à venir, à planifier, en attente du retour. */
    openInterviews: number
  }
  interviews: Record<'upcoming' | 'toSchedule' | 'awaiting', DashboardRound[]>
  todo: { id: number; label: string; dueDate: Day; opportunity: OpportunityRef }[]
  stale: {
    opportunity: OpportunityRef
    lastContactAt: Day | null
    /** Date de relance : saisie sur la piste, ou dernier contact + délai. */
    followUpAt: Day
    planned: boolean
  }[]
  noResponse: {
    opportunity: OpportunityRef
    lastContactAt: Day | null
    reason: NoResponseReason
    /** Fin du délai annoncé (DEADLINE), ou dernière réponse (SILENCE). */
    date: Day
  }[]
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

/** Fait défiler jusqu'à un bloc du tableau de bord. */
function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

/**
 * Chiffre clé ; l'icône et le libellé portent le sens, pas la couleur seule.
 * `to` mène à une page, `section` au bloc détaillé de cette page.
 */
function Kpi({
  value,
  label,
  icon: KpiIcon,
  color,
  to,
  section,
  help,
}: {
  value: number
  label: string
  /** Explication au survol : ce que le chiffre compte. */
  help: string
  icon: Icon
  color: string
  to?: string
  section?: string
}) {
  const alert = value > 0 && (color === 'red' || color === 'orange')
  const body = (
    <Card withBorder padding="sm" h="100%">
      <Group gap="sm" wrap="nowrap" align="flex-start">
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
  const content = to ? (
    <Anchor component={Link} to={to} underline="never" c="inherit">
      {body}
    </Anchor>
  ) : section ? (
    <Anchor
      href={`#${section}`}
      underline="never"
      c="inherit"
      onClick={(e) => {
        e.preventDefault()
        scrollToSection(section)
      }}
    >
      {body}
    </Anchor>
  ) : (
    body
  )
  return (
    <Tooltip label={help} multiline w={260} withArrow openDelay={300}>
      <Box h="100%">{content}</Box>
    </Tooltip>
  )
}

function Section({
  id,
  title,
  count,
  children,
}: {
  /** Ancre, cible des chiffres clés. */
  id?: string
  title: string
  count?: number
  children: ReactNode
}) {
  return (
    <Card withBorder id={id} style={{ scrollMarginTop: 72 }}>
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

function StaleList({ items, staleDays }: { items: Dashboard['stale']; staleDays: number }) {
  const [relaunching, setRelaunching] = useState<OpportunityRef | null>(null)
  if (!items.length) {
    return (
      <Empty>
        Aucune relance à faire (délai par défaut : {staleDays} jours après le dernier contact).
      </Empty>
    )
  }
  return (
    <>
      <Stack gap="sm">
        {items.map(({ opportunity, lastContactAt, followUpAt, planned }) => (
          <Group key={opportunity.id} justify="space-between" wrap="wrap" gap="xs">
            <Box miw={0} style={{ flex: '1 1 180px' }}>
              <OpportunityLink o={opportunity} />
              <Text size="xs" c="red.8">
                {planned || !lastContactAt
                  ? `Relance prévue le ${formatDay(followUpAt)}`
                  : `Dernier contact il y a ${daysSince(lastContactAt)} jours`}
              </Text>
            </Box>
            <Group gap={4} wrap="nowrap" style={{ flexShrink: 0 }}>
              <Tooltip
                label="Enregistre dans le journal la relance que tu as faite (mail, appel…) : la piste sort de la liste. Rien n'est envoyé."
                multiline
                w={260}
                withArrow
                openDelay={300}
              >
                <Button
                  size="compact-xs"
                  variant="light"
                  leftSection={<IconPencilPlus size={14} />}
                  onClick={() => setRelaunching(opportunity)}
                >
                  Noter une relance
                </Button>
              </Tooltip>
              <SnoozeMenu opportunityId={opportunity.id} planned={planned} />
            </Group>
          </Group>
        ))}
      </Stack>
      <FollowUpModal
        opportunityId={relaunching?.id ?? null}
        name={relaunching ? opportunityName(relaunching) : ''}
        onClose={() => setRelaunching(null)}
      />
    </>
  )
}

/** Candidatures restées sans réponse au-delà du délai annoncé : clôture proposée. */
function NoResponseList({ items }: { items: Dashboard['noResponse'] }) {
  return (
    <Stack gap="sm">
      {items.map(({ opportunity, reason, date }) => (
        <Group key={opportunity.id} justify="space-between" wrap="wrap" gap="xs">
          <Box miw={0} style={{ flex: '1 1 180px' }}>
            <OpportunityLink o={opportunity} />
            <Text size="xs" c="orange.8">
              {noResponseText(reason, date)}
            </Text>
          </Box>
          <Group gap={4} wrap="nowrap" style={{ flexShrink: 0 }}>
            <CloseNoResponseButton opportunityId={opportunity.id} reason={reason} date={date} />
            <StillWaitingMenu opportunityId={opportunity.id} reason={reason} />
          </Group>
        </Group>
      ))}
    </Stack>
  )
}

/** Pistes par étape, dans l'ordre du pipeline : libellé et nombre ; étapes clôturées en gris. */
function StageCounts({ byStage }: { byStage: Dashboard['byStage'] }) {
  return (
    <Stack gap={6} role="list" aria-label="Pistes par étape">
      {byStage.map((stage) => {
        const muted = isClosed(stage) || stage.count === 0
        return (
          <Group key={stage.id} justify="space-between" wrap="nowrap" role="listitem">
            <Group gap={8} wrap="nowrap" miw={0}>
              <ColorSwatch color={`var(--mantine-color-${stage.color}-6)`} size={10} />
              <Text size="sm" lineClamp={1} c={muted ? 'dimmed' : undefined}>
                {stage.label}
              </Text>
            </Group>
            <Text size="sm" fw={500} c={muted ? 'dimmed' : undefined}>
              {stage.count}
            </Text>
          </Group>
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
    return (
      <Empty>
        Aucun entretien en cours. Les entretiens se saisissent dans « Processus de recrutement » sur
        la fiche d'une piste ; ceux qui sont validés ou non retenus n'apparaissent plus ici.
      </Empty>
    )
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
              help="Pistes non clôturées (ni gagnées, ni perdues), sur le total des pistes."
              icon={IconBriefcase}
              color="blue"
              to="/pistes"
            />
            <Kpi
              value={data.kpis.overdue}
              label="en retard"
              help="Actions non faites dont l'échéance est dépassée, sur les pistes actives."
              icon={IconAlertTriangle}
              color="red"
              section="a-faire"
            />
            <Kpi
              value={data.kpis.dueToday}
              label="aujourd'hui"
              help="Actions non faites prévues aujourd'hui, sur les pistes actives."
              icon={IconCalendarDue}
              color="orange"
              section="a-faire"
            />
            <Kpi
              value={data.kpis.stale}
              label="à relancer"
              help={`Pistes actives dont la date de relance est atteinte : celle fixée sur la piste, sinon ${data.staleDays} jours après le dernier échange ou entretien (délai réglable dans les paramètres). Pas de relance tant qu'un entretien est prévu ou qu'une réponse est attendue.`}
              icon={IconClockPause}
              color="gray"
              section="a-relancer"
            />
            <Kpi
              value={data.kpis.openInterviews}
              label={`entretien${data.kpis.openInterviews > 1 ? 's' : ''} en cours`}
              help={`${data.interviews.upcoming.length} à venir, ${data.interviews.awaiting.length} en attente du retour, ${data.interviews.toSchedule.length} à planifier. Les entretiens validés ou non retenus ne comptent pas.`}
              icon={IconUsersGroup}
              color="violet"
              section="entretiens"
            />
            <Kpi
              value={data.kpis.contactsLastWeek}
              label="échanges 7 j"
              help="Échanges du journal et entretiens passés au cours des 7 derniers jours."
              icon={IconMessages}
              color="teal"
            />
          </SimpleGrid>

          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
            <Stack>
              <Section id="entretiens" title="Entretiens en cours" count={data.kpis.openInterviews}>
                <InterviewList interviews={data.interviews} />
              </Section>
              <Section id="a-faire" title="À faire" count={data.todo.length}>
                <TodoList items={data.todo} />
              </Section>
              {data.noResponse.length > 0 && (
                <Section id="sans-reponse" title="Sans réponse" count={data.noResponse.length}>
                  <NoResponseList items={data.noResponse} />
                </Section>
              )}
              <Section id="a-relancer" title="À relancer" count={data.stale.length}>
                <StaleList items={data.stale} staleDays={data.staleDays} />
              </Section>
            </Stack>
            <Stack>
              <Section title="Pistes par étape" count={data.kpis.total}>
                <StageCounts byStage={data.byStage} />
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
