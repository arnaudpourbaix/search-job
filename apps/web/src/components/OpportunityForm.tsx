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
import { useCampaigns } from '../campaigns.ts'
import { ContactsPicker } from './ContactPicker.tsx'
import { useCompanies, useRefLists, useTags } from '../queries.ts'
import { useStages } from '../settings.ts'
import type { OpportunityDetail, OpportunityInput } from '../types.ts'

type Values = {
  reference: string
  title: string
  stageId: string | null
  campaignId: string | null
  companyName: string
  intermediaryName: string
  intermediaryType: string | null
  contactIds: number[]
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

function initialValues(
  o?: OpportunityDetail,
  defaultCampaignId?: number,
  defaultStageId?: number,
): Values {
  const campaignId = o?.campaign.id ?? defaultCampaignId
  return {
    reference: o?.reference ?? '',
    title: o?.title ?? '',
    stageId: String(o?.stage.id ?? defaultStageId ?? '') || null,
    campaignId: campaignId ? String(campaignId) : null,
    companyName: o?.company?.name ?? '',
    intermediaryName: o?.intermediary?.name ?? '',
    intermediaryType: o?.intermediaryType ?? null,
    contactIds: o?.contacts.map((c) => c.id) ?? [],
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
  return {
    reference: text(v.reference),
    title: text(v.title),
    stageId: v.stageId ? Number(v.stageId) : undefined,
    campaignId: Number(v.campaignId),
    companyName: text(v.companyName),
    intermediaryName: text(v.intermediaryName),
    intermediaryType: text(v.intermediaryName) ? v.intermediaryType : null,
    contactIds: v.contactIds,
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
  /** Campagne proposée pour une nouvelle piste. */
  defaultCampaignId?: number
  submitting?: boolean
  onSubmit: (input: OpportunityInput) => void
  onCancel: () => void
}

export function OpportunityForm({
  opportunity,
  defaultCampaignId,
  submitting,
  onSubmit,
  onCancel,
}: Props) {
  const { data: lists } = useRefLists()
  const { data: campaigns = [] } = useCampaigns()
  const { data: stages = [] } = useStages()
  const { data: companies = [] } = useCompanies()
  const { data: tags = [] } = useTags()
  const companyNames = companies.map((c) => c.name)
  /** Adresse d'une entreprise connue, d'après son nom (casse ignorée). */
  const addressOf = (name: string) =>
    companies.find((c) => c.name.localeCompare(name.trim(), 'fr', { sensitivity: 'base' }) === 0)
      ?.address ?? null

  const form = useForm<Values>({
    initialValues: initialValues(opportunity, defaultCampaignId, stages[0]?.id),
    validate: {
      campaignId: (v) => (v ? null : 'Choisir une campagne'),
      companyName: (v, all) =>
        v.trim() || all.intermediaryName.trim()
          ? null
          : "Renseigner l'entreprise, ou au moins l'intermédiaire",
      url: (v) => (!v.trim() || /^https?:\/\//i.test(v.trim()) ? null : 'URL invalide'),
      salaryMax: (v, all) => minMax(all.salaryMin, v),
      tjmMax: (v, all) => minMax(all.tjmMin, v),
    },
  })

  const companyInput = form.getInputProps('companyName')
  /**
   * Choisir une entreprise qui a une adresse préremplit le lieu, s'il est vide ou
   * s'il reprenait l'adresse de l'entreprise précédente (un lieu saisi est gardé).
   */
  const changeCompany = (name: string) => {
    const previous = addressOf(form.values.companyName)
    companyInput.onChange(name)
    const address = addressOf(name)
    const location = form.values.location.trim()
    if (address && (!location || location === previous)) form.setFieldValue('location', address)
  }

  return (
    <form onSubmit={form.onSubmit((v) => onSubmit(toInput(v)))}>
      <Stack>
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <Autocomplete
            label="Entreprise"
            description="Là où tu travailleras · vide si encore inconnue"
            data={companyNames}
            data-autofocus
            {...companyInput}
            onChange={changeCompany}
          />
          <Select
            label="Étape"
            description="Avancement de la candidature"
            data={stages.map((s) => ({ value: String(s.id), label: s.label }))}
            allowDeselect={false}
            {...form.getInputProps('stageId')}
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
        <Select
          label="Campagne"
          description="Recherche à laquelle la piste appartient"
          data={campaigns.map((c) => ({
            value: String(c.id),
            label: c.endDate ? `${c.name} (terminée)` : c.name,
          }))}
          allowDeselect={false}
          {...form.getInputProps('campaignId')}
        />

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

        <Divider label="Contacts" labelPosition="left" />
        <ContactsPicker
          value={form.values.contactIds}
          onChange={(ids) => form.setFieldValue('contactIds', ids)}
          defaultCompany={
            text(form.values.intermediaryName) ?? text(form.values.companyName)
          }
        />

        <Divider label="Conditions" labelPosition="left" />
        <SimpleGrid cols={{ base: 2, sm: 3 }}>
          <TextInput
            label="Lieu"
            placeholder="Adresse de l'entreprise"
            {...form.getInputProps('location')}
          />
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
