import {
  ActionIcon,
  Badge,
  Button,
  Card,
  CheckIcon,
  ColorSwatch,
  Group,
  Popover,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
  UnstyledButton,
} from '@mantine/core'
import { useForm } from '@mantine/form'
import { useDisclosure } from '@mantine/hooks'
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
  plural,
  STAGE_COLOR_OPTIONS,
  STAGE_KIND_INFO,
  useStageMutations,
  useStages,
  type StageRow,
} from '../settings.ts'
import type { StageKind } from '../types.ts'

const sameLabel = (a: string, b: string) =>
  a.localeCompare(b, 'fr', { sensitivity: 'base' }) === 0

const KIND_OPTIONS = (Object.keys(STAGE_KIND_INFO) as StageKind[]).map((k) => ({
  value: k,
  label: STAGE_KIND_INFO[k].label,
}))

const swatch = (color: string) => `var(--mantine-color-${color}-filled)`

/** Pastille de couleur cliquable, avec la palette en popover. */
function ColorPicker({
  value,
  onChange,
  label,
}: {
  value: string
  onChange: (color: string) => void
  label: string
}) {
  const [opened, { toggle, close }] = useDisclosure()
  return (
    <Popover opened={opened} onChange={(o) => !o && close()} position="bottom-start" withArrow>
      <Popover.Target>
        <UnstyledButton onClick={toggle} aria-label={label} style={{ display: 'flex' }}>
          <ColorSwatch color={swatch(value)} size={22} />
        </UnstyledButton>
      </Popover.Target>
      <Popover.Dropdown p="xs">
        <SimpleGrid cols={7} spacing={6}>
          {STAGE_COLOR_OPTIONS.map((c) => (
            <ColorSwatch
              key={c}
              component="button"
              type="button"
              color={swatch(c)}
              size={24}
              aria-label={c}
              title={c}
              style={{ cursor: 'pointer', color: 'white' }}
              onClick={() => {
                close()
                if (c !== value) onChange(c)
              }}
            >
              {c === value && <CheckIcon size={10} />}
            </ColorSwatch>
          ))}
        </SimpleGrid>
      </Popover.Dropdown>
    </Popover>
  )
}

/** Suppression : si des pistes sont dans l'étape, une étape de remplacement est obligatoire. */
function RemoveStage({ stage, stages, onDone }: { stage: StageRow; stages: StageRow[]; onDone: () => void }) {
  const { remove } = useStageMutations()
  const [replaceWith, setReplaceWith] = useState<string | null>(null)
  const others = stages
    .filter((s) => s.id !== stage.id)
    .map((s) => ({ value: String(s.id), label: s.label }))
  const needsReplacement = stage.usage > 0

  const confirm = () =>
    remove.mutate(
      { id: stage.id, replaceWith: replaceWith ? Number(replaceWith) : null },
      {
        onSuccess: ({ updated }) => {
          const target = stages.find((s) => String(s.id) === replaceWith)
          notifications.show({
            message: updated
              ? `« ${stage.label} » supprimée, ${plural(updated, 'piste')} déplacée${updated > 1 ? 's' : ''} vers « ${target?.label} »`
              : `« ${stage.label} » supprimée`,
          })
          onDone()
        },
      },
    )

  return (
    <Stack gap="sm">
      {needsReplacement ? (
        <>
          <Text size="sm">
            {plural(stage.usage, 'piste')} {stage.usage > 1 ? 'sont' : 'est'} à l'étape « {stage.label} ». Choisis
            l'étape où {stage.usage > 1 ? 'les' : 'la'} déplacer.
          </Text>
          <Select
            label="Remplacer par"
            placeholder="Choisir une étape"
            data={others}
            value={replaceWith}
            onChange={setReplaceWith}
            required
          />
        </>
      ) : (
        <Text size="sm">L'étape « {stage.label} » sera retirée du pipeline.</Text>
      )}
      <Group justify="flex-end" gap="xs" mt="xs">
        <Button variant="default" onClick={onDone}>
          Annuler
        </Button>
        <Button
          color="red"
          disabled={needsReplacement && !replaceWith}
          loading={remove.isPending}
          onClick={confirm}
        >
          Supprimer
        </Button>
      </Group>
    </Stack>
  )
}

function StageItem({ stage, stages, index }: { stage: StageRow; stages: StageRow[]; index: number }) {
  const { update, reorder } = useStageMutations()
  const [editing, setEditing] = useState(false)
  const form = useForm({
    initialValues: { label: stage.label },
    validate: {
      label: (v) => {
        const t = v.trim()
        if (!t) return 'Libellé obligatoire'
        if (stages.some((s) => s.id !== stage.id && sameLabel(s.label, t))) return 'Existe déjà'
        return null
      },
    },
  })

  const move = (delta: number) => {
    const ids = stages.map((s) => s.id)
    const [moved] = ids.splice(index, 1)
    ids.splice(index + delta, 0, moved)
    reorder.mutate(ids)
  }

  const openRemove = () => {
    const id = modals.open({
      title: `Supprimer l'étape « ${stage.label} » ?`,
      children: <RemoveStage stage={stage} stages={stages} onDone={() => modals.close(id)} />,
    })
  }

  const label = editing ? (
    <form
      style={{ flex: '1 1 180px' }}
      onSubmit={form.onSubmit(({ label }) => {
        const next = label.trim()
        if (next === stage.label) return setEditing(false)
        update.mutate({ id: stage.id, label: next }, { onSuccess: () => setEditing(false) })
      })}
    >
      <Group gap={4} wrap="nowrap" align="flex-start">
        <TextInput
          size="xs"
          style={{ flex: 1 }}
          autoFocus
          aria-label="Nouveau libellé"
          onKeyDown={(e) => e.key === 'Escape' && setEditing(false)}
          {...form.getInputProps('label')}
        />
        <ActionIcon type="submit" size="md" aria-label="Enregistrer" loading={update.isPending}>
          <IconCheck size={16} />
        </ActionIcon>
        <ActionIcon variant="default" size="md" aria-label="Annuler" onClick={() => setEditing(false)}>
          <IconX size={16} />
        </ActionIcon>
      </Group>
    </form>
  ) : (
    <Group gap="xs" wrap="nowrap" miw={0} style={{ flex: '1 1 180px' }}>
      <Text size="sm" fw={500} truncate onDoubleClick={() => setEditing(true)}>
        {stage.label}
      </Text>
      {stage.usage > 0 && (
        <Badge size="xs" variant="light" color="gray" style={{ flexShrink: 0 }}>
          {plural(stage.usage, 'piste')}
        </Badge>
      )}
    </Group>
  )

  return (
    <Group
      gap="xs"
      wrap="wrap"
      justify="space-between"
      py={6}
      style={{ borderTop: index > 0 ? '1px solid var(--mantine-color-default-border)' : undefined }}
    >
      <Group gap="xs" wrap="nowrap" style={{ flex: '1 1 220px' }} miw={0}>
        <ColorPicker
          value={stage.color}
          label={`Couleur de « ${stage.label} »`}
          onChange={(color) => update.mutate({ id: stage.id, color })}
        />
        {label}
      </Group>
      <Group gap={4} wrap="nowrap">
        <Select
          size="xs"
          w={120}
          aria-label={`Nature de « ${stage.label} »`}
          data={KIND_OPTIONS}
          value={stage.kind}
          allowDeselect={false}
          onChange={(kind) => kind && update.mutate({ id: stage.id, kind: kind as StageKind })}
          renderOption={({ option }) => (
            <div>
              <Text size="sm">{option.label}</Text>
              <Text size="xs" c="dimmed">
                {STAGE_KIND_INFO[option.value as StageKind].help}
              </Text>
            </div>
          )}
          comboboxProps={{ width: 260, position: 'bottom-end' }}
        />
        <ActionIcon variant="subtle" color="gray" aria-label="Monter" disabled={index === 0} onClick={() => move(-1)}>
          <IconArrowUp size={16} />
        </ActionIcon>
        <ActionIcon
          variant="subtle"
          color="gray"
          aria-label="Descendre"
          disabled={index === stages.length - 1}
          onClick={() => move(1)}
        >
          <IconArrowDown size={16} />
        </ActionIcon>
        <ActionIcon variant="subtle" color="gray" aria-label="Renommer" onClick={() => setEditing(true)}>
          <IconPencil size={16} />
        </ActionIcon>
        <ActionIcon variant="subtle" color="red" aria-label="Supprimer" onClick={openRemove}>
          <IconTrash size={16} />
        </ActionIcon>
      </Group>
    </Group>
  )
}

export function StagesCard() {
  const { data: stages = [] } = useStages()
  const { add } = useStageMutations()
  const [color, setColor] = useState<string>('gray')
  const form = useForm({
    initialValues: { label: '' },
    validate: {
      label: (v) => {
        const t = v.trim()
        if (!t) return 'Libellé obligatoire'
        if (stages.some((s) => sameLabel(s.label, t))) return 'Existe déjà'
        return null
      },
    },
  })

  return (
    <Card withBorder>
      <Title order={4}>Étapes du pipeline</Title>
      <Text size="sm" c="dimmed" mb="sm">
        Colonnes du pipeline, dans l'ordre. La nature d'une étape décide si la piste est en cours, compte comme
        entretien, ou est clôturée (gagnée ou perdue).
      </Text>

      <Stack gap={0}>
        {stages.map((s, index) => (
          <StageItem key={s.id} stage={s} stages={stages} index={index} />
        ))}
      </Stack>

      <form
        onSubmit={form.onSubmit(({ label }) =>
          add.mutate(
            { label: label.trim(), color },
            {
              onSuccess: () => {
                form.reset()
                setColor('gray')
              },
            },
          ),
        )}
      >
        <Group gap="xs" mt="md" align="flex-start" wrap="nowrap">
          <Group h={36} align="center">
            <ColorPicker value={color} label="Couleur de la nouvelle étape" onChange={setColor} />
          </Group>
          <TextInput
            placeholder="Nouvelle étape (ajoutée en fin de pipeline)"
            aria-label="Ajouter une étape"
            style={{ flex: 1 }}
            {...form.getInputProps('label')}
          />
          <ActionIcon type="submit" size="lg" aria-label="Ajouter l'étape" loading={add.isPending}>
            <IconPlus size={18} />
          </ActionIcon>
        </Group>
      </form>
    </Card>
  )
}
