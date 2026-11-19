import { Button, Group, Stack, Textarea, TextInput } from '@mantine/core'
import { useForm } from '@mantine/form'
import { IconCheck } from '@tabler/icons-react'
import { useCompanyMutations } from '../companies.ts'
import type { Company } from '../types.ts'

export function CompanyForm({
  company,
  onSaved,
  onCancel,
}: {
  /** Entreprise modifiée ; absente pour une création. */
  company?: Company
  onSaved: () => void
  onCancel: () => void
}) {
  const { create, update } = useCompanyMutations()
  const form = useForm({
    initialValues: { name: company?.name ?? '', notes: company?.notes ?? '' },
    validate: { name: (v) => (v.trim() ? null : 'Nom obligatoire') },
  })

  const submit = (v: { name: string; notes: string }) => {
    const body = { name: v.name.trim(), notes: v.notes.trim() || null }
    if (company) update.mutate({ id: company.id, ...body }, { onSuccess: onSaved })
    else create.mutate(body, { onSuccess: onSaved })
  }

  return (
    <form onSubmit={form.onSubmit(submit)} autoComplete="off">
      <Stack gap="sm">
        <TextInput
          label="Nom"
          withAsterisk
          data-autofocus
          autoComplete="off"
          {...form.getInputProps('name')}
        />
        <Textarea
          label="Notes"
          placeholder="Secteur, taille, impressions…"
          autosize
          minRows={3}
          {...form.getInputProps('notes')}
        />
        <Group justify="flex-end" gap="xs">
          <Button variant="default" onClick={onCancel}>
            Annuler
          </Button>
          <Button
            type="submit"
            leftSection={<IconCheck size={16} />}
            loading={create.isPending || update.isPending}
          >
            {company ? 'Enregistrer' : 'Ajouter'}
          </Button>
        </Group>
      </Stack>
    </form>
  )
}
