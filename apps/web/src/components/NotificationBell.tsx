import {
  ActionIcon,
  Box,
  Button,
  Center,
  Divider,
  Group,
  Indicator,
  Loader,
  Popover,
  ScrollArea,
  Stack,
  Text,
  ThemeIcon,
  Tooltip,
  UnstyledButton,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import {
  IconAlertTriangle,
  IconBell,
  IconCalendarDue,
  IconCalendarEvent,
  IconCheck,
  IconClockPause,
  IconMail,
  IconMailOpened,
  type Icon,
} from '@tabler/icons-react'
import { useNavigate } from 'react-router'
import { formatDay, opportunityName, opportunitySubtitle } from '../format.ts'
import {
  useNotificationMutations,
  useNotifications,
  type AppNotification,
  type NotificationType,
} from '../notifications.ts'

const TYPE_INFO: Record<NotificationType, { icon: Icon; color: string; label: string }> = {
  ACTION_OVERDUE: { icon: IconAlertTriangle, color: 'red', label: 'En retard' },
  ACTION_DUE_TODAY: { icon: IconCalendarDue, color: 'orange', label: "Aujourd'hui" },
  ACTION_UPCOMING: { icon: IconCalendarEvent, color: 'yellow', label: 'À venir' },
  STALE_OPPORTUNITY: { icon: IconClockPause, color: 'gray', label: 'À relancer' },
}

function when(n: AppNotification): string {
  const { label } = TYPE_INFO[n.type]
  const due = n.action?.dueDate
  return due && n.type !== 'ACTION_DUE_TODAY' ? `${label} · ${formatDay(due)}` : label
}

function NotificationItem({ n, onOpen }: { n: AppNotification; onOpen: () => void }) {
  const { markRead, completeAction } = useNotificationMutations()
  const { icon: TypeIcon, color } = TYPE_INFO[n.type]
  const subtitle = opportunitySubtitle(n.opportunity)

  return (
    <Group
      gap="sm"
      wrap="nowrap"
      align="flex-start"
      p="xs"
      bg={n.read ? undefined : 'var(--mantine-color-blue-light)'}
      style={{ borderRadius: 'var(--mantine-radius-sm)' }}
    >
      <ThemeIcon color={color} variant="light" size="md" mt={2}>
        <TypeIcon size={16} />
      </ThemeIcon>
      <UnstyledButton onClick={onOpen} style={{ flex: 1, minWidth: 0 }}>
        <Text size="sm" fw={n.read ? 400 : 600} truncate>
          {opportunityName(n.opportunity)}
        </Text>
        {subtitle && (
          <Text size="xs" c="dimmed" truncate>
            {subtitle}
          </Text>
        )}
        <Text size="sm" lineClamp={2}>
          {n.message}
        </Text>
        <Text size="xs" c={color === 'gray' ? 'dimmed' : `${color}.8`}>
          {when(n)}
        </Text>
      </UnstyledButton>
      <Stack gap={2}>
        {n.action && (
          <Tooltip label="Marquer l'action comme faite" withinPortal={false}>
            <ActionIcon
              variant="subtle"
              color="green"
              aria-label="Action faite"
              loading={completeAction.isPending}
              onClick={() => completeAction.mutate(n.action!.id)}
            >
              <IconCheck size={16} />
            </ActionIcon>
          </Tooltip>
        )}
        <Tooltip label={n.read ? 'Marquer comme non lu' : 'Marquer comme lu'} withinPortal={false}>
          <ActionIcon
            variant="subtle"
            color="gray"
            aria-label={n.read ? 'Marquer comme non lu' : 'Marquer comme lu'}
            onClick={() => markRead.mutate({ id: n.id, read: !n.read })}
          >
            {n.read ? <IconMail size={16} /> : <IconMailOpened size={16} />}
          </ActionIcon>
        </Tooltip>
      </Stack>
    </Group>
  )
}

export function NotificationBell() {
  const [opened, { toggle, close }] = useDisclosure()
  const navigate = useNavigate()
  const { data, isPending, isError, error } = useNotifications()
  const { markRead, markAllRead } = useNotificationMutations()
  const unread = data?.unread ?? 0

  const open = (n: AppNotification) => {
    if (!n.read) markRead.mutate({ id: n.id, read: true })
    close()
    void navigate(`/pistes/${n.opportunity.id}`)
  }

  return (
    <Popover
      opened={opened}
      onChange={(o) => !o && close()}
      position="bottom-end"
      width={400}
      styles={{ dropdown: { maxWidth: 'calc(100vw - 16px)' } }}
      shadow="md"
      withArrow
    >
      <Popover.Target>
        <Indicator
          label={unread > 99 ? '99+' : unread}
          size={18}
          color="red"
          disabled={unread === 0}
          offset={6}
        >
          <ActionIcon
            variant="subtle"
            size="lg"
            aria-label={unread ? `Notifications (${unread} non lues)` : 'Notifications'}
            onClick={toggle}
          >
            <IconBell size={20} />
          </ActionIcon>
        </Indicator>
      </Popover.Target>

      <Popover.Dropdown p={0}>
        <Group justify="space-between" px="sm" py="xs">
          <Text fw={600}>Notifications</Text>
          {unread > 0 && (
            <Button size="compact-xs" variant="subtle" onClick={() => markAllRead.mutate()}>
              Tout marquer comme lu
            </Button>
          )}
        </Group>
        <Divider />
        {isPending ? (
          <Center p="lg">
            <Loader size="sm" />
          </Center>
        ) : isError ? (
          <Text c="red" size="sm" p="sm">
            {error.message}
          </Text>
        ) : data.items.length === 0 ? (
          <Text c="dimmed" size="sm" ta="center" p="lg">
            Rien à signaler : aucune action à faire dans les 7 jours, aucune piste à relancer.
          </Text>
        ) : (
          <ScrollArea.Autosize mah="min(70vh, 560px)" type="auto">
            <Box p={4}>
              <Stack gap={4}>
                {data.items.map((n) => (
                  <NotificationItem key={n.id} n={n} onOpen={() => open(n)} />
                ))}
              </Stack>
            </Box>
          </ScrollArea.Autosize>
        )}
      </Popover.Dropdown>
    </Popover>
  )
}
