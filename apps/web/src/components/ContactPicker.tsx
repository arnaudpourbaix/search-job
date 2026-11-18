import {
  ActionIcon,
  Button,
  Group,
  MultiSelect,
  Select,
  Stack,
  Text,
  Tooltip,
  type ComboboxItem,
  type ComboboxParsedItem,
  type OptionsFilter,
} from '@mantine/core'
import { IconPlus, IconUserPlus } from '@tabler/icons-react'
import { useState } from 'react'
import { openContactModal } from '../contactModal.tsx'
import { contactDetails, contactSearchText, normalizeSearch, useContacts } from '../contacts.ts'
import type { ContactRef } from '../types.ts'

type Option = ComboboxItem & { details: string; search: string }

const toOption = (c: ContactRef): Option => ({
  value: String(c.id),
  label: c.name,
  details: contactDetails(c),
  search: contactSearchText(c),
})

/** Recherche sur le nom, la fonction, la société et les coordonnées, sans accents. */
const filter: OptionsFilter = ({ options, search }) => {
  const q = normalizeSearch(search)
  if (!q) return options
  const match = (o: ComboboxParsedItem) => (o as Option).search.includes(q)
  return options
    .map((o) => ('group' in o ? { ...o, items: o.items.filter(match) } : o))
    .filter((o) => ('group' in o ? o.items.length > 0 : match(o)))
}

const renderOption = ({ option }: { option: ComboboxItem }) => {
  const { details } = option as Option
  return (
    <div>
      <Text size="sm">{option.label}</Text>
      {details && (
        <Text size="xs" c="dimmed">
          {details}
        </Text>
      )}
    </div>
  )
}

/** Contacts de la piste d'abord (s'ils sont fournis), puis le reste du carnet. */
function groupedOptions(contacts: ContactRef[], opportunityContacts?: ContactRef[]) {
  if (!opportunityContacts) return contacts.map(toOption)
  const own = new Set(opportunityContacts.map((c) => c.id))
  return [
    { group: 'Contacts de la piste', items: opportunityContacts.map(toOption) },
    { group: 'Carnet', items: contacts.filter((c) => !own.has(c.id)).map(toOption) },
  ].filter((g) => g.items.length)
}

/**
 * Choix multiple dans le carnet (contacts d'une piste, interlocuteurs d'un entretien),
 * avec création sur place.
 */
export function ContactsPicker({
  value,
  onChange,
  defaultCompany,
  opportunityContacts,
  label,
  ariaLabel = 'Contacts de la piste',
  description = 'Choisis dans le carnet : nom, fonction ou société',
}: {
  value: number[]
  onChange: (ids: number[]) => void
  /** Société proposée pour un nouveau contact (intermédiaire ou entreprise de la piste). */
  defaultCompany: string | null
  /** Contacts déjà sur la piste, proposés en premier. */
  opportunityContacts?: ContactRef[]
  label?: string
  ariaLabel?: string
  description?: string
}) {
  const { data: contacts = [] } = useContacts()
  const [search, setSearch] = useState('')

  const create = () =>
    openContactModal({
      initial: { name: search.trim(), companyName: defaultCompany },
      onSaved: (c) => {
        setSearch('')
        onChange([...value, c.id])
      },
    })

  return (
    <Stack gap={6}>
      <MultiSelect
        label={label}
        aria-label={label ? undefined : ariaLabel}
        description={description}
        placeholder={value.length ? undefined : 'Rechercher un contact'}
        data={groupedOptions(contacts, opportunityContacts)}
        value={value.map(String)}
        onChange={(ids) => onChange(ids.map(Number))}
        searchable
        searchValue={search}
        onSearchChange={setSearch}
        filter={filter}
        renderOption={renderOption}
        nothingFoundMessage="Aucun contact : crée-le avec le bouton ci-dessous"
        hidePickedOptions
        clearable
      />
      <Group>
        <Button
          size="compact-sm"
          variant="subtle"
          leftSection={<IconUserPlus size={14} />}
          onClick={create}
        >
          {search.trim() ? `Créer « ${search.trim()} »` : 'Nouveau contact'}
        </Button>
      </Group>
    </Stack>
  )
}

/**
 * Interlocuteur d'un échange : les contacts de la piste d'abord, puis le reste du carnet.
 * Un nouveau contact peut être créé sur place.
 */
export function ContactSelect({
  value,
  onChange,
  opportunityContacts,
  defaultCompany,
}: {
  value: number | null
  onChange: (id: number | null) => void
  opportunityContacts: ContactRef[]
  defaultCompany: string | null
}) {
  const { data: contacts = [] } = useContacts()
  const [search, setSearch] = useState('')
  const data = groupedOptions(contacts, opportunityContacts)

  return (
    <Group gap={4} wrap="nowrap" align="flex-start">
      <Select
        style={{ flex: 1, minWidth: 0 }}
        placeholder="Interlocuteur"
        aria-label="Interlocuteur"
        data={data}
        value={value === null ? null : String(value)}
        onChange={(v) => onChange(v ? Number(v) : null)}
        searchable
        searchValue={search}
        onSearchChange={setSearch}
        filter={filter}
        renderOption={renderOption}
        nothingFoundMessage="Aucun contact"
        clearable
      />
      <Tooltip label="Nouveau contact">
        <ActionIcon
          variant="default"
          size="input-sm"
          aria-label="Nouveau contact"
          onClick={() =>
            openContactModal({
              initial: {
                // Le texte tapé n'est un nom que s'il ne correspond pas déjà au contact choisi.
                name: value === null ? search.trim() : '',
                companyName: defaultCompany,
              },
              onSaved: (c) => onChange(c.id),
            })
          }
        >
          <IconPlus size={16} />
        </ActionIcon>
      </Tooltip>
    </Group>
  )
}
