import { ActionIcon, AppShell, Burger, Group, NavLink, Title, Tooltip } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import {
  IconBell,
  IconBriefcase,
  IconLayoutDashboard,
  IconLayoutKanban,
  IconSettings,
} from '@tabler/icons-react'
import { NavLink as RouterNavLink, Outlet } from 'react-router'

const links = [
  { to: '/', label: 'Tableau de bord', icon: IconLayoutDashboard },
  { to: '/pistes', label: 'Pistes', icon: IconBriefcase },
  { to: '/pipeline', label: 'Pipeline', icon: IconLayoutKanban },
  { to: '/parametres', label: 'Paramètres', icon: IconSettings },
]

export function AppLayout() {
  const [opened, { toggle, close }] = useDisclosure()

  return (
    <AppShell
      header={{ height: 56 }}
      navbar={{ width: 240, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group gap="sm">
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" aria-label="Menu" />
            <Title order={4}>Search Job</Title>
          </Group>
          <Tooltip label="Notifications">
            <ActionIcon variant="subtle" size="lg" aria-label="Notifications">
              <IconBell size={20} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="xs">
        {links.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            component={RouterNavLink}
            to={to}
            end={to === '/'}
            label={label}
            leftSection={<Icon size={18} />}
            onClick={close}
          />
        ))}
      </AppShell.Navbar>

      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  )
}
