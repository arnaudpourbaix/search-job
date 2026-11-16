import {
  Autocomplete,
  Button,
  Divider,
  Group,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  TagsInput,
  Textarea,
  TextInput,
} from '@mantine/core'
import { useForm } from '@mantine/form'
import { STAGE_LABELS } from '../format.ts'
import { useCompanies, useRefLists, useTags } from '../queries.ts'
import { STAGES, type OpportunityDetail, type OpportunityInput, type Stage } from '../types.ts'

type Values = {
  reference: string
  title: string
  stage: Stage
  companyName: string
  intermediaryName: string
  intermediaryType: string | null
  contactName: string
  contactEmail: string
  contactPhone: string
  platform: string
  contractType: string
  location: string
  remoteDays: number | string
  duration: string
  salaryMin: number | string
  salaryMax: number | string
  tjmMin: number | string
  tjmMax: number | string
  tags: string[]
  url: string
  notes: string
}

const text = (v: string) => (v.trim() === '' ? null : v.trim())
const num = (v: number | string) => (v === '' || v === null ? null : Number(v))

function initialValues(o?: OpportunityDetail): Values {
  return {
    reference: o?.reference ?? '',
    title: o?.title ?? '',
    stage: o?.stage ?? 'TO_CONTACT',
    companyName: o?.company?.name ?? '',
    intermediaryName: o?.intermediary?.name ?? '',
    intermediaryType: o?.intermediaryType ?? null,
    contactName: o?.contact?.name ?? '',
    contactEmail: o?.contact?.email ?? '',
    contactPhone: o?.contact?.phone ?? '',
    platform: o?.platform ?? '',
    contractType: o?.contractType ?? '',
    location: o?.location ?? '',
    remoteDays: o?.remoteDays ?? '',
    duration: o?.duration ?? '',
    salaryMin: o?.salaryMin ?? '',
    salaryMax: o?.salaryMax ?? '',
    tjmMin: o?.tjmMin ?? '',
    tjmMax: o?.tjmMax ?? '',
    tags: o?.tags ?? [],
    url: o?.url ?? '',
    notes: o?.notes ?? '',
  }
}

function toInput(v: Values): OpportunityInput {
  const contactName = text(v.contactName)
  return {
    reference: text(v.reference),
    title: text(v.title),
    stage: v.stage,
    companyName: text(v.companyName),
    intermediaryName: text(v.intermediaryName),
    intermediaryType: text(v.intermediaryName) ? v.intermediaryType : null,
    contact: contactName
      ? { name: contactName, email: text(v.contactEmail), phone: text(v.contactPhone) }
      : null,
    platform: text(v.platform),
    contractType: text(v.contractType),
    location: text(v.location),
    remoteDays: num(v.remoteDays),
    duration: text(v.duration),
    salaryMin: num(v.salaryMin),
    salaryMax: num(v.salaryMax),
    tjmMin: num(v.tjmMin),
    tjmMax: num(v.tjmMax),
    tags: v.tags,
    url: text(v.url),
    notes: text(v.notes),
  }
}

const minMax = (min: number | string, max: number | string) =>
  min !== '' && max !== '' && Number(min) > Number(max) ? 'Le max doit être ≥ au min' : null

type Props = {
  opportunity?: OpportunityDetail
  submitting?: boolean
  onSubmit: (input: OpportunityInput) => void
  onCancel: () => void
}

export function OpportunityForm({ opportunity, submitting, onSubmit, onCancel }: Props) {
  const { data: lists } = useRefLists()
  const { data: companies = [] } = useCompanies()
  const { data: tags = [] } = useTags()
  const companyNames = companies.map((c) => c.name)

  const form = useForm<Values>({
    initialValues: initialValues(opportunity),
    validate: {
      companyName: (v, all) =>
        v.trim() || all.intermediaryName.trim()
          ? null
          : "Renseigner l'entreprise, ou au moins l'intermédiaire",
      contactEmail: (v) =>
        !v.trim() || /^\S+@\S+\.\S+$/.test(v.trim()) ? null : 'Email invalide',
      url: (v) => (!v.trim() || /^https?:\/\//i.test(v.trim()) ? null : 'URL invalide'),
      salaryMax: (v, all) => minMax(all.salaryMin, v),
      tjmMax: (v, all) => minMax(all.tjmMin, v),
    },
  })

  return (
    <form onSubmit={form.onSubmit((v) => onSubmit(toInput(v)))}>
      <Stack>
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <Autocomplete
            label="Entreprise"
            description="Là où tu travailleras · vide si encore inconnue"
            data={companyNames}
            data-autofocus
            {...form.getInputProps('companyName')}
          />
          <Select
            label="Étape"
            description="Avancement de la candidature"
            data={STAGES.map((s) => ({ value: s, label: STAGE_LABELS[s] }))}
            allowDeselect={false}
            {...form.getInputProps('stage')}
          />
          <Autocomplete
            label="Intermédiaire"
            description="Apporteur d'affaires, portage, cabinet… · vide si en direct"
            data={companyNames}
            {...form.getInputProps('intermediaryName')}
          />
          <Select
            label="Type d'intermédiaire"
            description="Liste modifiable dans les paramètres"
            data={lists?.INTERMEDIARY_TYPE ?? []}
            disabled={!form.values.intermediaryName.trim()}
            clearable
            {...form.getInputProps('intermediaryType')}
          />
        </SimpleGrid>

        <Divider label="Poste" labelPosition="left" />
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <TextInput label="Intitulé du poste" {...form.getInputProps('title')} />
          <TagsInput
            label="Stack"
            placeholder="Entrée pour ajouter"
            data={tags}
            clearable
            {...form.getInputProps('tags')}
          />
          <Autocomplete
            label="Type de contrat"
            data={lists?.CONTRACT_TYPE ?? []}
            {...form.getInputProps('contractType')}
          />
          <Autocomplete
            label="Plateforme (où l'offre a été trouvée)"
            data={lists?.PLATFORM ?? []}
            {...form.getInputProps('platform')}
          />
          <TextInput
            label="Référence de l'annonce"
            placeholder="ex. BPCE_INFO01289"
            {...form.getInputProps('reference')}
          />
          <TextInput label="Lien de l'annonce" type="url" {...form.getInputProps('url')} />
        </SimpleGrid>

        <Divider
          label="Contact (chez l'intermédiaire s'il y en a un)"
          labelPosition="left"
        />
        <SimpleGrid cols={{ base: 1, sm: 3 }}>
          <TextInput label="Nom" {...form.getInputProps('contactName')} />
          <TextInput label="Email" type="email" {...form.getInputProps('contactEmail')} />
          <TextInput label="Téléphone" type="tel" {...form.getInputProps('contactPhone')} />
        </SimpleGrid>

        <Divider label="Conditions" labelPosition="left" />
        <SimpleGrid cols={{ base: 2, sm: 3 }}>
          <TextInput label="Lieu" {...form.getInputProps('location')} />
          <NumberInput
            label="Télétravail (j/sem)"
            min={0}
            max={5}
            allowDecimal={false}
            {...form.getInputProps('remoteDays')}
          />
          <TextInput label="Durée" placeholder="ex. 3 ans" {...form.getInputProps('duration')} />
          <NumberInput
            label="TJM min (€/j)"
            min={0}
            allowDecimal={false}
            thousandSeparator=" "
            {...form.getInputProps('tjmMin')}
          />
          <NumberInput
            label="TJM max (€/j)"
            min={0}
            allowDecimal={false}
            thousandSeparator=" "
            {...form.getInputProps('tjmMax')}
          />
          <div />
          <NumberInput
            label="Salaire min (€/an)"
            min={0}
            step={1000}
            allowDecimal={false}
            thousandSeparator=" "
            {...form.getInputProps('salaryMin')}
          />
          <NumberInput
            label="Salaire max (€/an)"
            min={0}
            step={1000}
            allowDecimal={false}
            thousandSeparator=" "
            {...form.getInputProps('salaryMax')}
          />
        </SimpleGrid>

        <Textarea label="Notes" autosize minRows={3} {...form.getInputProps('notes')} />

        <Group justify="flex-end">
          <Button variant="default" onClick={onCancel}>
            Annuler
          </Button>
          <Button type="submit" loading={submitting}>
            {opportunity ? 'Enregistrer' : 'Créer la piste'}
          </Button>
        </Group>
      </Stack>
    </form>
  )
}
