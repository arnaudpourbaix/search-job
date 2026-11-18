import { Anchor, Group, Stack, Text } from '@mantine/core'
import { IconMail, IconPhone } from '@tabler/icons-react'
import { Link } from 'react-router'
import { contactDetails } from '../contacts.ts'
import { formatPhone, phoneHref } from '../format.ts'
import type { ContactRef } from '../types.ts'

/** Contacts d'une piste : nom (lien vers le carnet), fonction · société, mail et téléphone cliquables. */
export function ContactLines({ contacts }: { contacts: ContactRef[] }) {
  return (
    <Stack gap="sm">
      {contacts.map((c) => {
        const details = contactDetails(c)
        return (
          <div key={c.id}>
            <Group gap={6} wrap="wrap">
              <Anchor
                component={Link}
                to={`/contacts?q=${encodeURIComponent(c.name)}`}
                size="sm"
                fw={500}
                c="var(--mantine-color-text)"
              >
                {c.name}
              </Anchor>
              {details && (
                <Text span size="sm" c="dimmed">
                  {details}
                </Text>
              )}
            </Group>
            {(c.email || c.phone) && (
              <Group gap="md" wrap="wrap">
                {c.email && (
                  <Anchor href={`mailto:${c.email}`} size="sm">
                    <Group gap={4} wrap="nowrap">
                      <IconMail size={14} />
                      {c.email}
                    </Group>
                  </Anchor>
                )}
                {c.phone && (
                  <Anchor href={phoneHref(c.phone)} size="sm">
                    <Group gap={4} wrap="nowrap">
                      <IconPhone size={14} />
                      {formatPhone(c.phone)}
                    </Group>
                  </Anchor>
                )}
              </Group>
            )}
          </div>
        )
      })}
    </Stack>
  )
}
