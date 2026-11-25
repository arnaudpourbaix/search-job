import { Button, Card, Group, NumberInput, Stack, Text, Title } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconCheck } from '@tabler/icons-react'
import { useState } from 'react'
import { useSilenceDays, useStaleDays, useUpdateFollowUpSettings } from '../followUp.ts'

const STALE = { min: 1, max: 90 }
const SILENCE = { min: 7, max: 180 }

const isValid = (v: number | string, { min, max }: { min: number; max: number }) =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max

/**
 * Délai de relance (une piste sans contact depuis ce délai est « à relancer ») et
 * délai de silence (sans réponse malgré des relances, la clôture est proposée).
 */
export function FollowUpSettingsCard() {
  const staleDays = useStaleDays()
  const silenceDays = useSilenceDays()
  const update = useUpdateFollowUpSettings()
  const [stale, setStale] = useState<number | string>(staleDays)
  const [silence, setSilence] = useState<number | string>(silenceDays)
  const valid = isValid(stale, STALE) && isValid(silence, SILENCE)
  const changed = stale !== staleDays || silence !== silenceDays

  return (
    <Card withBorder>
      <Title order={4}>Relances</Title>
      <Stack gap={4} mb="sm">
        <Text size="sm" c="dimmed">
          Une piste active est « à relancer » quand son dernier échange (réponse ou relance) ou
          entretien date de plus que le délai de relance, sauf date de relance fixée sur la piste.
        </Text>
        <Text size="sm" c="dimmed">
          Sans aucune réponse depuis le délai de silence malgré au moins une relance, la piste passe
          « sans réponse » sur le tableau de bord et sa clôture est proposée.
        </Text>
      </Stack>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (!valid) return
          update.mutate(
            { staleDays: Number(stale), silenceDays: Number(silence) },
            {
              onSuccess: () =>
                notifications.show({
                  color: 'green',
                  message: `Relance après ${stale} j, clôture proposée après ${silence} j de silence`,
                }),
            },
          )
        }}
      >
        <Group align="flex-end" gap="xs">
          <NumberInput
            label="Délai de relance"
            suffix=" jours"
            min={STALE.min}
            max={STALE.max}
            allowDecimal={false}
            allowNegative={false}
            w={160}
            value={stale}
            onChange={setStale}
            error={
              stale !== '' && !isValid(stale, STALE)
                ? `Entre ${STALE.min} et ${STALE.max} jours`
                : undefined
            }
          />
          <NumberInput
            label="Délai de silence"
            suffix=" jours"
            min={SILENCE.min}
            max={SILENCE.max}
            allowDecimal={false}
            allowNegative={false}
            w={160}
            value={silence}
            onChange={setSilence}
            error={
              silence !== '' && !isValid(silence, SILENCE)
                ? `Entre ${SILENCE.min} et ${SILENCE.max} jours`
                : undefined
            }
          />
          <Button
            type="submit"
            leftSection={<IconCheck size={16} />}
            disabled={!valid || !changed}
            loading={update.isPending}
          >
            Enregistrer
          </Button>
        </Group>
      </form>
    </Card>
  )
}
