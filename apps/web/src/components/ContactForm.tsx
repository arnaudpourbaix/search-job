import { Autocomplete, Button, Group, SimpleGrid, Stack, Textarea, TextInput } from '@mantine/core'
import { useForm } from '@mantine/form'
import { IconCheck } from '@tabler/icons-react'
import { useContactMutations } from '../contacts.ts'
import { formatPhone } from '../format.ts'
import { useCompanies } from '../queries.ts'
import type { Contact, ContactInput } from '../types.ts'

type Values = Record<keyof ContactInput, string>

const text = (v: string) => (v.trim() === '' ? null : v.trim())

export function ContactForm({
  contact,
  initial,
  onSaved,
  onCancel,
}: {
  /** Contact modifié ; absent pour une création. */
  contact?: Contact
  /** Valeurs proposées pour une création (nom tapé, société de la piste…). */
  initial?: Partial<ContactInput>
  onSaved: (c: Contact) => void
  onCancel: () => void
}) {
  const { data: companies = [] } = useCompanies()
  const { create, update } = useContactMutations()
  const source = contact ? { ...contact, companyName: contact.company?.name ?? null } : initial
  const form = useForm<Values>({
    initialValues: {
      name: source?.name ?? '',
      title: source?.title ?? '',
      companyName: source?.companyName ?? '',
      email: source?.email ?? '',
      phone: source?.phone ?? '',
      linkedin: source?.linkedin ?? '',
      notes: source?.notes ?? '',
    },
    validate: {
      name: (v) => (v.trim() ? null : 'Nom obligatoire'),
      email: (v) => (!v.trim() || /^\S+@\S+\.\S+$/.test(v.trim()) ? null : 'Email invalide'),
      linkedin: (v) => (!v.trim() || /^https?:\/\//i.test(v.trim()) ? null : 'Lien invalide'),
    },
  })

  const submit = (v: Values) => {
    const body: ContactInput = {
      name: v.name.trim(),
      title: text(v.title),
      companyName: text(v.companyName),
      email: text(v.email),
      phone: text(formatPhone(v.phone)),
      linkedin: text(v.linkedin),
      notes: text(v.notes),
    }
    if (contact) update.mutate({ id: contact.id, ...body }, { onSuccess: onSaved })
    else create.mutate(body, { onSuccess: onSaved })
  }

  return (
    <form onSubmit={form.onSubmit(submit)} autoComplete="off">
      <Stack gap="sm">
        <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="sm">
          <TextInput
            label="Nom"
            withAsterisk
            data-autofocus
            autoComplete="off"
            {...form.getInputProps('name')}
          />
          <TextInput
            label="Fonction"
            placeholder="Recruteur, RH, lead dev…"
            {...form.getInputProps('title')}
          />
          <Autocomplete
            label="Société"
            placeholder="Cabinet, ESN, client…"
            data={companies.map((c) => c.name)}
            {...form.getInputProps('companyName')}
          />
          <TextInput
            label="Téléphone"
            type="tel"
            placeholder="01 23 45 67 89"
            autoComplete="off"
            {...form.getInputProps('phone')}
            onBlur={() => form.setFieldValue('phone', formatPhone(form.values.phone))}
          />
          <TextInput
            label="Email"
            type="email"
            autoComplete="off"
            {...form.getInputProps('email')}
          />
          <TextInput
            label="LinkedIn"
            placeholder="https://www.linkedin.com/in/…"
            {...form.getInputProps('linkedin')}
          />
        </SimpleGrid>
        <Textarea label="Notes" autosize minRows={2} {...form.getInputProps('notes')} />
        <Group justify="flex-end" gap="xs">
          <Button variant="default" onClick={onCancel}>
            Annuler
          </Button>
          <Button
            type="submit"
            leftSection={<IconCheck size={16} />}
            loading={create.isPending || update.isPending}
          >
            {contact ? 'Enregistrer' : 'Ajouter au carnet'}
          </Button>
        </Group>
      </Stack>
    </form>
  )
}
