import { Badge, Card, Group, Stack, Text, Title } from '@mantine/core'
import { useEffect, useState } from 'react'
import { apiGet } from '../api.ts'

type Health = { status: string; opportunities: number }

export function DashboardPage() {
  const [health, setHealth] = useState<Health | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    apiGet<Health>('/health').then(setHealth, (e: Error) => setError(e.message))
  }, [])

  return (
    <Stack>
      <Title order={2}>Tableau de bord</Title>
      <Card withBorder>
        <Group justify="space-between">
          <Text fw={500}>Connexion à l'API</Text>
          {error ? (
            <Badge color="red">Erreur : {error}</Badge>
          ) : health ? (
            <Badge color="green">OK · {health.opportunities} piste(s)</Badge>
          ) : (
            <Badge color="gray">Chargement…</Badge>
          )}
        </Group>
      </Card>
    </Stack>
  )
}
