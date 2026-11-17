import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Center,
  Group,
  Loader,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core'
import { useForm } from '@mantine/form'
import { modals } from '@mantine/modals'
import { notifications } from '@mantine/notifications'
import {
  IconArrowDown,
  IconArrowUp,
  IconCheck,
  IconPencil,
  IconPlus,
  IconTrash,
  IconX,
} from '@tabler/icons-react'
import { useState } from 'react'
import {
  LIST_INFO,
  plural,
  useEditableLists,
  useListMutations,
  type EditableList,
  type ListItem,
} from '../settings.ts'

const sameValue = (a: string, b: string) =>
  a.localeCompare(b, 'fr', { sensitivity: 'base' }) === 0

/** Contenu de la confirmation de suppression : remplacement facultatif. */
function RemoveContent({
  item,
  others,
  usedIn,
  onChange,
}: {
  item: ListItem
  others: string[]
  usedIn: string
  onChange: (v: string | null) => void
}) {
  const [replaceWith, setReplaceWith] = useState<string | null>(null)
  if (item.usage === 0) {
    return <Text size="sm">« {item.value} » sera retiré de la liste.</Text>
  }
  return (
    <Stack gap="sm">
      <Text size="sm">
        « {item.value} » est utilisé dans {plural(item.usage, usedIn)}.
      </Text>
      <Select
        label="Remplacer par"
        description={`Laisser vide : les ${usedIn}s gardent « ${item.value} », hors liste.`}
        placeholder="Ne pas remplacer"
        data={others}
        value={replaceWith}
        clearable
        onChange={(v) => {
          setReplaceWith(v)
          onChange(v)
        }}
        comboboxProps={{ withinPortal: false }}
      />
    </Stack>
  )
}

function ItemRow({
  list,
  item,
  index,
}: {
  list: EditableList
  item: ListItem
  index: number
}) {
  const { rename, reorder, remove } = useListMutations()
  const info = LIST_INFO[list.category]
  const [editing, setEditing] = useState(false)
  const form = useForm({
    initialValues: { value: item.value },
    validate: {
      value: (v) => {
        const t = v.trim()
        if (!t) return 'Valeur obligatoire'
        if (list.items.some((i) => i.id !== item.id && sameValue(i.value, t))) {
          return 'Existe déjà'
        }
        return null
      },
    },
  })

  const move = (delta: number) => {
    const ids = list.items.map((i) => i.id)
    const [moved] = ids.splice(index, 1)
    ids.splice(index + delta, 0, moved)
    reorder.mutate({ category: list.category, ids })
  }

  const confirmRemove = () => {
    let replaceWith: string | null = null
    modals.openConfirmModal({
      title: `Supprimer « ${item.value} » ?`,
      children: (
        <RemoveContent
          item={item}
          usedIn={info.usedIn}
          others={list.items.filter((i) => i.id !== item.id).map((i) => i.value)}
          onChange={(v) => (replaceWith = v)}
        />
      ),
      labels: { confirm: 'Supprimer', cancel: 'Annuler' },
      confirmProps: { color: 'red' },
      onConfirm: () =>
        remove.mutate(
          { id: item.id, replaceWith },
          {
            onSuccess: ({ updated }) =>
              notifications.show({
                message: updated
                  ? `« ${item.value} » supprimé, remplacé par « ${replaceWith} » (${plural(updated, info.usedIn)})`
                  : `« ${item.value} » supprimé`,
              }),
          },
        ),
    })
  }

  if (editing) {
    return (
      <form
        onSubmit={form.onSubmit(({ value }) => {
          const next = value.trim()
          if (next === item.value) return setEditing(false)
          rename.mutate(
            { id: item.id, value: next },
            {
              onSuccess: ({ updated }) => {
                setEditing(false)
                if (updated) {
                  notifications.show({
                    message: `Renommé en « ${next} » (${plural(updated, info.usedIn)} mis à jour)`,
                  })
                }
              },
            },
          )
        })}
      >
        <Group gap={4} wrap="nowrap" align="flex-start">
          <TextInput
            size="xs"
            style={{ flex: 1 }}
            autoFocus
            aria-label="Nouvelle valeur"
            onKeyDown={(e) => e.key === 'Escape' && setEditing(false)}
            {...form.getInputProps('value')}
          />
          <ActionIcon type="submit" size="md" aria-label="Enregistrer" loading={rename.isPending}>
            <IconCheck size={16} />
          </ActionIcon>
          <ActionIcon variant="default" size="md" aria-label="Annuler" onClick={() => setEditing(false)}>
            <IconX size={16} />
          </ActionIcon>
        </Group>
      </form>
    )
  }

  return (
    <Group gap="xs" wrap="nowrap" justify="space-between">
      <Group gap="xs" wrap="nowrap" miw={0}>
        <Text size="sm" truncate onDoubleClick={() => setEditing(true)}>
          {item.value}
        </Text>
        {item.usage > 0 && (
          <Badge size="xs" variant="light" color="gray" style={{ flexShrink: 0 }}>
            {plural(item.usage, info.usedIn)}
          </Badge>
        )}
      </Group>
      <Group gap={2} wrap="nowrap">
        <ActionIcon
          variant="subtle"
          color="gray"
          aria-label="Monter"
          disabled={index === 0}
          onClick={() => move(-1)}
        >
          <IconArrowUp size={16} />
        </ActionIcon>
        <ActionIcon
          variant="subtle"
          color="gray"
          aria-label="Descendre"
          disabled={index === list.items.length - 1}
          onClick={() => move(1)}
        >
          <IconArrowDown size={16} />
        </ActionIcon>
        <ActionIcon variant="subtle" color="gray" aria-label="Renommer" onClick={() => setEditing(true)}>
          <IconPencil size={16} />
        </ActionIcon>
        <ActionIcon variant="subtle" color="red" aria-label="Supprimer" onClick={confirmRemove}>
          <IconTrash size={16} />
        </ActionIcon>
      </Group>
    </Group>
  )
}

function ListCard({ list }: { list: EditableList }) {
  const { add } = useListMutations()
  const info = LIST_INFO[list.category]
  const form = useForm({
    initialValues: { value: '' },
    validate: {
      value: (v) => {
        const t = v.trim()
        if (!t) return 'Valeur obligatoire'
        if (list.items.some((i) => sameValue(i.value, t))) return 'Existe déjà'
        return null
      },
    },
  })

  return (
    <Card withBorder>
      <Title order={4}>{info.title}</Title>
      <Text size="sm" c="dimmed" mb="sm">
        {info.description}
      </Text>

      <Stack gap={6}>
        {list.items.length === 0 && (
          <Text size="sm" c="dimmed" fs="italic">
            Liste vide.
          </Text>
        )}
        {list.items.map((item, index) => (
          <ItemRow key={item.id} list={list} item={item} index={index} />
        ))}
      </Stack>

      <form
        onSubmit={form.onSubmit(({ value }) =>
          add.mutate(
            { category: list.category, value: value.trim() },
            { onSuccess: () => form.reset() },
          ),
        )}
      >
        <Group gap="xs" mt="md" align="flex-start" wrap="nowrap">
          <TextInput
            placeholder="Nouvelle valeur"
            aria-label={`Ajouter à ${info.title}`}
            style={{ flex: 1 }}
            {...form.getInputProps('value')}
          />
          <ActionIcon type="submit" size="lg" aria-label="Ajouter" loading={add.isPending}>
            <IconPlus size={18} />
          </ActionIcon>
        </Group>
      </form>

      {list.unlisted.length > 0 && (
        <Alert mt="md" color="yellow" variant="light" p="xs">
          <Text size="xs" mb={6}>
            Valeurs utilisées mais absentes de la liste :
          </Text>
          <Group gap={6}>
            {list.unlisted.map((u) => (
              <Tooltip key={u.value} label="Ajouter à la liste">
                <Button
                  size="compact-xs"
                  variant="white"
                  color="dark"
                  leftSection={<IconPlus size={12} />}
                  onClick={() => add.mutate({ category: list.category, value: u.value })}
                >
                  {u.value} ({u.usage})
                </Button>
              </Tooltip>
            ))}
          </Group>
        </Alert>
      )}
    </Card>
  )
}

export function SettingsPage() {
  const { data, isPending, isError, error } = useEditableLists()

  return (
    <Stack>
      <div>
        <Title order={2}>Paramètres</Title>
        <Text c="dimmed">
          Listes proposées dans les formulaires. Un renommage est répercuté sur les pistes
          et le journal.
        </Text>
      </div>

      {isPending ? (
        <Center p="xl">
          <Loader />
        </Center>
      ) : isError ? (
        <Alert color="red" title="Impossible de charger les paramètres">
          {error.message}
        </Alert>
      ) : (
        <SimpleGrid cols={{ base: 1, md: 2 }}>
          {data.map((list) => (
            <ListCard key={list.category} list={list} />
          ))}
        </SimpleGrid>
      )}
    </Stack>
  )
}
