import { ActionIcon, Avatar, Menu, Text } from '@mantine/core'
import { IconLogout } from '@tabler/icons-react'
import { logout, useMe } from '../auth.ts'

/** Avatar du compte connecté, avec la déconnexion. */
export function UserMenu() {
  const { data: me } = useMe()
  if (!me) return null
  const label = me.name ?? me.email

  return (
    <Menu position="bottom-end" width={240} withinPortal>
      <Menu.Target>
        <ActionIcon variant="subtle" radius="xl" size="lg" aria-label={`Compte : ${label}`}>
          <Avatar
            src={me.picture}
            alt={label}
            name={label}
            color="initials"
            size={30}
            // Les photos Google refusent parfois les requêtes avec Referer.
            imageProps={{ referrerPolicy: 'no-referrer' }}
          />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>
          {me.name && (
            <Text size="sm" fw={500} c="var(--mantine-color-text)" truncate>
              {me.name}
            </Text>
          )}
          <Text size="xs" c="dimmed" truncate>
            {me.email}
          </Text>
        </Menu.Label>
        <Menu.Divider />
        {/* Sans session, l'application redirige d'elle-même vers /login. */}
        <Menu.Item leftSection={<IconLogout size={16} />} onClick={() => void logout()}>
          Se déconnecter
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  )
}
