import { Button, Card, Group, NumberInput, Text, Title } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconCheck } from '@tabler/icons-react'
import { useState } from 'react'
import { useStaleDays, useUpdateStaleDays } from '../followUp.ts'

const MIN = 1
const MAX = 90

/** Délai de relance : au-delà, une piste active sans contact est « à relancer ». */
export function FollowUpSettingsCard() {
  const current = useStaleDays()
  const update = useUpdateStaleDays()
  const [value, setValue] = useState<number | string>(current)
  const days = typeof value === 'number' ? value : Number.NaN
  const valid = Number.isInteger(days) && days >= MIN && days <= MAX

  return (
    <Card withBorder>
      <Title order={4}>Relances</Title>
      <Text size="sm" c="dimmed" mb="sm">
        Une piste active est « à relancer » quand son dernier échange ou entretien date de plus de
        ce nombre de jours. Elle apparaît alors sur le tableau de bord et dans les notifications.
      </Text>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (!valid) return
          update.mutate(days, {
            onSuccess: () =>
              notifications.show({
                color: 'green',
                message: `Délai de relance : ${days} jour${days > 1 ? 's' : ''}`,
              }),
          })
        }}
      >
        <Group align="flex-end" gap="xs">
          <NumberInput
            label="Délai de relance"
            suffix=" jours"
            min={MIN}
            max={MAX}
            allowDecimal={false}
            allowNegative={false}
            w={160}
            value={value}
            onChange={setValue}
            error={value !== '' && !valid ? `Entre ${MIN} et ${MAX} jours` : undefined}
          />
          <Button
            type="submit"
            leftSection={<IconCheck size={16} />}
            disabled={!valid || days === current}
            loading={update.isPending}
          >
            Enregistrer
          </Button>
        </Group>
      </form>
    </Card>
  )
}
