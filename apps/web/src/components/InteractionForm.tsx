import { Button, Group, Select, Stack, Textarea } from '@mantine/core'
import { DateInput } from '@mantine/dates'
import { useForm } from '@mantine/form'
import { IconCheck } from '@tabler/icons-react'
import { today } from '../format.ts'
import { useRefLists, type InteractionInput } from '../queries.ts'
import type { OpportunityDetail } from '../types.ts'
import { ContactSelect } from './ContactPicker.tsx'

export type InteractionValues = {
  date: string | null
  channel: string | null
  summary: string
  contactId: number | null
}

/** Formulaire d'échange, pour l'ajout comme pour la modification. */
export function InteractionForm({
  o,
  initial,
  submitLabel,
  loading,
  onSubmit,
  onCancel,
}: {
  o: OpportunityDetail
  initial: InteractionValues
  submitLabel: string
  loading: boolean
  onSubmit: (v: InteractionInput) => void
  onCancel?: () => void
}) {
  const { data: lists } = useRefLists()
  const form = useForm<InteractionValues>({
    initialValues: initial,
    validate: {
      date: (v) => (v ? null : 'Date obligatoire'),
      summary: (v) => (v.trim() ? null : 'Résumé obligatoire'),
    },
  })

  return (
    <form
      onSubmit={form.onSubmit((v) =>
        onSubmit({
          date: v.date!,
          channel: v.channel,
          summary: v.summary.trim(),
          contactId: v.contactId,
        }),
      )}
    >
      <Stack gap="xs">
        <Group gap="xs" grow>
          <DateInput
            valueFormat="DD/MM/YYYY"
            locale="fr"
            maxDate={today()}
            aria-label="Date de l'échange"
            {...form.getInputProps('date')}
          />
          <Select
            placeholder="Canal"
            aria-label="Canal"
            data={lists?.CHANNEL ?? []}
            clearable
            {...form.getInputProps('channel')}
          />
        </Group>
        <ContactSelect
          value={form.values.contactId}
          onChange={(id) => form.setFieldValue('contactId', id)}
          opportunityContacts={o.contacts}
          defaultCompany={o.intermediary?.name ?? o.company?.name ?? null}
        />
        <Textarea
          placeholder="Résumé de l'échange"
          aria-label="Résumé de l'échange"
          autosize
          minRows={2}
          data-autofocus={onCancel ? true : undefined}
          {...form.getInputProps('summary')}
        />
        <Group justify="flex-end" gap="xs">
          {onCancel && (
            <Button size="xs" variant="default" onClick={onCancel}>
              Annuler
            </Button>
          )}
          <Button type="submit" size="xs" leftSection={<IconCheck size={14} />} loading={loading}>
            {submitLabel}
          </Button>
        </Group>
      </Stack>
    </form>
  )
}
