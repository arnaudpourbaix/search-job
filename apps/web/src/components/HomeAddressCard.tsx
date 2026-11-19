import { Button, Card, Group, Text, TextInput, Title } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconCheck } from '@tabler/icons-react'
import { useState } from 'react'
import { useHomeAddress, useUpdateHomeAddress } from '../maps.ts'

/** Adresse de départ des itinéraires vers le lieu des pistes. */
export function HomeAddressCard() {
  const current = useHomeAddress() ?? ''
  const update = useUpdateHomeAddress()
  const [value, setValue] = useState(current)
  const next = value.trim().replace(/\s+/g, ' ')

  return (
    <Card withBorder>
      <Title order={4}>Itinéraires</Title>
      <Text size="sm" c="dimmed" mb="sm">
        Point de départ des itinéraires en transports en commun (train, métro, bus) proposés à côté
        du lieu d'une piste. Vide : Google Maps part de ta position.
      </Text>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          update.mutate(next || null, {
            onSuccess: () =>
              notifications.show({
                color: 'green',
                message: next ? 'Adresse de départ enregistrée' : 'Adresse de départ effacée',
              }),
          })
        }}
      >
        <Group align="flex-end" gap="xs">
          <TextInput
            label="Adresse de départ"
            placeholder="Domicile, ex. 1 place du Capitole, Toulouse"
            maxLength={300}
            style={{ flex: '1 1 280px' }}
            value={value}
            onChange={(e) => setValue(e.currentTarget.value)}
          />
          <Button
            type="submit"
            leftSection={<IconCheck size={16} />}
            disabled={next === current}
            loading={update.isPending}
          >
            Enregistrer
          </Button>
        </Group>
      </form>
    </Card>
  )
}
