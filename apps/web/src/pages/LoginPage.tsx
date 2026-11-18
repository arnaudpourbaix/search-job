import { Alert, Button, Card, Center, Stack, Text, Title } from '@mantine/core'
import { IconBrandGoogle, IconBriefcase } from '@tabler/icons-react'
import { useSearchParams } from 'react-router'

/** Messages des échecs renvoyés par l'API (/login?error=…). */
const ERRORS: Record<string, { title: string; message: string }> = {
  forbidden: {
    title: 'Accès refusé',
    message: "Ce compte Google n'est pas autorisé à utiliser l'application.",
  },
  expired: {
    title: 'Connexion interrompue',
    message: 'La connexion a pris trop de temps ou a été interrompue. Réessaie.',
  },
  google: {
    title: 'Connexion impossible',
    message: "Google n'a pas confirmé la connexion. Réessaie dans un instant.",
  },
  config: {
    title: 'Connexion non configurée',
    message: "La connexion Google n'est pas encore configurée sur le serveur.",
  },
}

export function LoginPage() {
  const [params] = useSearchParams()
  const error = ERRORS[params.get('error') ?? '']

  return (
    <Center mih="100dvh" p="md" bg="var(--mantine-color-body)">
      <Card withBorder shadow="sm" padding="xl" radius="md" w="100%" maw={400}>
        <Stack align="center" gap="lg">
          <IconBriefcase size={40} stroke={1.5} color="var(--mantine-primary-color-filled)" />
          <Stack gap={4} align="center">
            <Title order={2}>Job Search</Title>
            <Text c="dimmed" ta="center" size="sm">
              Suivi de recherche d'emploi : pistes, échanges, entretiens et contacts.
            </Text>
          </Stack>
          {error && (
            <Alert color="red" title={error.title} w="100%">
              {error.message}
            </Alert>
          )}
          {/* Navigation complète : l'API redirige vers Google puis revient ici. */}
          <Button
            component="a"
            href="/api/auth/google"
            size="md"
            fullWidth
            variant="default"
            leftSection={<IconBrandGoogle size={18} />}
          >
            Se connecter avec Google
          </Button>
        </Stack>
      </Card>
    </Center>
  )
}
