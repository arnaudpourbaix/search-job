import { Box, Group, Text, Tooltip } from '@mantine/core'
import { ROUND_STATE_INFO, roundState, roundTitle, roundWhen } from '../interviews.ts'
import type { InterviewProgress } from '../types.ts'

const SEGMENT_COLORS = {
  PASSED: 'var(--mantine-color-green-6)',
  FAILED: 'var(--mantine-color-red-6)',
  DONE: 'var(--mantine-color-yellow-5)',
  PLANNED: 'var(--mantine-color-gray-3)',
} as const

/**
 * Progression compacte du processus de recrutement : une case par tour
 * (vert validé, jaune en attente, rouge non retenu, gris à venir), puis le tour en cours.
 * Le texte porte le sens ; la frise n'est qu'un repère visuel.
 */
export function InterviewSteps({ progress }: { progress: InterviewProgress | null }) {
  if (!progress) return null
  const { current } = progress
  const state = current ? roundState(current) : null
  const info = state ? ROUND_STATE_INFO[state] : null
  const when = current ? roundWhen(current) : null

  const summary = progress.failed
    ? 'Non retenu'
    : current
      ? `${roundTitle(current)} : ${info!.label.toLowerCase()}${when ? ` (${when})` : ''}`
      : `${progress.passed} entretien${progress.passed > 1 ? 's' : ''} validé${progress.passed > 1 ? 's' : ''}`

  return (
    <Tooltip
      label={`Entretien ${Math.min(progress.passed + 1, progress.total)}/${progress.total} · ${summary}`}
      openDelay={300}
    >
      <Box miw={0}>
        <Group gap={2} wrap="nowrap" aria-hidden>
          {progress.steps.map((s, i) => (
            <Box
              key={i}
              h={5}
              style={{
                flex: '1 1 0',
                maxWidth: 28,
                borderRadius: 2,
                background: SEGMENT_COLORS[s],
              }}
            />
          ))}
        </Group>
        <Text size="xs" mt={3} lineClamp={1} c={progress.failed ? 'red.8' : undefined}>
          {progress.failed ? (
            'Non retenu'
          ) : current ? (
            <>
              <Text span size="xs" fw={600}>
                {roundTitle(current)}
              </Text>
              <Text span size="xs" c={state === 'OUTDATED' ? 'orange.8' : 'dimmed'}>
                {' · '}
                {when && state === 'UPCOMING' ? when : info!.label.toLowerCase()}
              </Text>
            </>
          ) : (
            <Text span size="xs" c="green.8">
              {summary}
            </Text>
          )}
        </Text>
      </Box>
    </Tooltip>
  )
}
