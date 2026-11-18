import { AppShell, Burger, Group, NavLink, Title } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import {
  IconBriefcase,
  IconAddressBook,
  IconFlag,
  IconLayoutDashboard,
  IconLayoutKanban,
  IconSettings,
} from '@tabler/icons-react'
import { NavLink as RouterNavLink, Outlet } from 'react-router'
import { CampaignSelect } from '../components/CampaignSelect.tsx'
import { NotificationBell } from '../components/NotificationBell.tsx'

const links = [
  { to: '/', label: 'Tableau de bord', icon: IconLayoutDashboard },
  { to: '/pistes', label: 'Pistes', icon: IconBriefcase },
  { to: '/pipeline', label: 'Pipeline', icon: IconLayoutKanban },
  { to: '/contacts', label: 'Contacts', icon: IconAddressBook },
  { to: '/campagnes', label: 'Campagnes', icon: IconFlag },
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
        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
          <Group gap="sm" wrap="nowrap">
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" aria-label="Menu" />
            <Title order={4} visibleFrom="xs" style={{ whiteSpace: 'nowrap' }}>
              Search Job
            </Title>
          </Group>
          <Group gap="xs" wrap="nowrap">
            <CampaignSelect />
            <NotificationBell />
          </Group>
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
