import { Button, Group, Modal, Select, Stack, Text } from '@mantine/core'
import { useState, type ReactNode } from 'react'
import { useUpdateOpportunity } from '../queries.ts'
import { useStages } from '../settings.ts'

/**
 * Propose de clore une piste sur une étape « perdue » (entretien non retenu,
 * candidature restée sans réponse…). Rien n'est fait d'office.
 */
export function ClosePrompt({
  opportunityId,
  opened,
  onClose,
  prefer,
  children,
}: {
  /** Libellé de l'étape perdue à présélectionner (ex. « Sans suite »), si elle existe. */
  prefer?: string
  opportunityId: number
  opened: boolean
  onClose: () => void
  /** Pourquoi la clôture est proposée. */
  children: ReactNode
}) {
  const { data: stages } = useStages()
  const lost = (stages ?? []).filter((s) => s.kind === 'LOST')
  const [stageId, setStageId] = useState<string | null>(null)
  const update = useUpdateOpportunity(opportunityId)
  const preferred =
    lost.find(
      (s) => prefer && s.label.localeCompare(prefer, 'fr', { sensitivity: 'base' }) === 0,
    ) ?? lost[0]
  const selected = stageId ?? (preferred ? String(preferred.id) : null)

  return (
    <Modal opened={opened && lost.length > 0} onClose={onClose} title="Clore la piste ?">
      <Stack gap="sm">
        <Text size="sm">
          {children} Veux-tu passer la piste à une étape de clôture ? Elle sortira alors des pistes
          actives, du tableau de bord et des relances.
        </Text>
        <Select
          label="Étape"
          data={lost.map((s) => ({ value: String(s.id), label: s.label }))}
          value={selected}
          onChange={setStageId}
          allowDeselect={false}
        />
        <Group justify="flex-end" gap="xs">
          <Button variant="default" onClick={onClose}>
            Garder la piste ouverte
          </Button>
          <Button
            color="red"
            loading={update.isPending}
            disabled={!selected}
            onClick={() => update.mutate({ stageId: Number(selected) }, { onSuccess: onClose })}
          >
            Clore la piste
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}
