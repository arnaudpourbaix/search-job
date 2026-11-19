/** Nature d'une étape : pilote la clôture des pistes et les statistiques. */
export type StageKind = 'OPEN' | 'ADVANCED' | 'WON' | 'LOST'

/** Étape du pipeline, configurable dans les paramètres. */
export type Stage = { id: number; label: string; color: string; kind: StageKind }

export type Ref = { id: number; name: string }

/** Contact du carnet, tel qu'affiché sur une piste ou un échange. */
export type ContactRef = {
  id: number
  name: string
  /** Fonction : recruteur, RH, lead dev… */
  title: string | null
  email: string | null
  phone: string | null
  /** Société du contact (intermédiaire ou client). */
  company: Ref | null
}

/** Fiche du carnet de contacts. */
export type Contact = ContactRef & {
  linkedin: string | null
  notes: string | null
  /** Pistes où il intervient (toutes campagnes). */
  opportunities: {
    id: number
    reference: string | null
    title: string | null
    stage: Stage
    company: Ref | null
    intermediary: Ref | null
    campaign: Ref
  }[]
  interactionCount: number
  interviewCount: number
  lastInteractionAt: Day | null
}

/** Entreprise : client ou intermédiaire, avec ses contacts et ses pistes. */
export type Company = Ref & {
  /** Adresse ; préremplit le lieu des pistes chez cette entreprise. */
  address: string | null
  notes: string | null
  contacts: { id: number; name: string; title: string | null }[]
  /** Pistes où elle est le client (CLIENT) ou l'intermédiaire (INTERMEDIARY). */
  opportunities: (Contact['opportunities'][number] & { role: 'CLIENT' | 'INTERMEDIARY' })[]
}

export type CompanyInput = { name: string; address: string | null; notes: string | null }

/** Corps envoyé pour créer / modifier un contact (null = effacer). */
export type ContactInput = {
  name: string
  title: string | null
  companyName: string | null
  email: string | null
  phone: string | null
  linkedin: string | null
  notes: string | null
}

/** Dates « jour » au format YYYY-MM-DD. */
export type Day = string

/** Statut d'un tour du processus de recrutement. */
export type InterviewStatus = 'PLANNED' | 'DONE' | 'PASSED' | 'FAILED'

/** Tour du processus de recrutement (échange client, entretien RH, test…). */
export type InterviewRound = {
  id: number
  type: string
  /** Précision, ex. « anglais ». */
  label: string | null
  /** null = à planifier. */
  date: Day | null
  /** « HH:MM » */
  time: string | null
  status: InterviewStatus
  notes: string | null
  /** Interlocuteurs (carnet). */
  contacts: ContactRef[]
}

/** Où en est le processus : statut de chaque tour et tour en cours. */
export type InterviewProgress = {
  total: number
  passed: number
  failed: boolean
  steps: InterviewStatus[]
  /** Premier tour ni validé ni refusé. */
  current: Omit<InterviewRound, 'id' | 'notes'> | null
}

export type NextAction = { id: number; label: string; dueDate: Day | null }

export type OpportunitySummary = {
  id: number
  /** Référence de l'annonce (facultative). */
  reference: string | null
  title: string | null
  stage: Stage
  platform: string | null
  contractType: string | null
  location: string | null
  remoteDays: number | null
  salaryMin: number | null
  salaryMax: number | null
  tjmMin: number | null
  tjmMax: number | null
  /** Entreprise où l'on travaillerait (null si encore inconnue). */
  company: Ref | null
  /** Intermédiaire éventuel : apporteur d'affaires, portage, cabinet de recrutement… */
  intermediary: Ref | null
  intermediaryType: string | null
  /** Interlocuteurs, choisis dans le carnet. */
  contacts: ContactRef[]
  tags: string[]
  firstContactAt: Day | null
  lastContactAt: Day | null
  nextAction: NextAction | null
  openActions: number
  /** Processus de recrutement (null : aucun tour). */
  interviews: InterviewProgress | null
  /** Campagne de recherche de la piste. */
  campaign: { id: number; name: string; endDate: Day | null }
  /** Même entreprise proposée sur plusieurs pistes de la campagne. */
  duplicateCompany: boolean
  /** Relance reportée : pas « à relancer » avant ce jour (null : pas de report). */
  snoozedUntil: Day | null
  updatedAt: string
}

export type Interaction = {
  id: number
  date: Day
  channel: string | null
  summary: string
  /** Interlocuteur de l'échange. */
  contact: ContactRef | null
}

export type Action = {
  id: number
  label: string
  dueDate: Day | null
  doneAt: string | null
}

export type OpportunityDetail = Omit<OpportunitySummary, 'openActions' | 'interviews'> & {
  interviews: InterviewRound[]
  interviewProgress: InterviewProgress | null
  duration: string | null
  url: string | null
  notes: string | null
  createdAt: string
  interactions: Interaction[]
  actions: Action[]
}

/** Corps envoyé pour créer / modifier une piste (null = effacer). */
export type OpportunityInput = {
  reference: string | null
  title: string | null
  /** Absent à la création : première étape du pipeline. */
  stageId?: number
  campaignId: number
  platform: string | null
  contractType: string | null
  location: string | null
  remoteDays: number | null
  duration: string | null
  salaryMin: number | null
  salaryMax: number | null
  tjmMin: number | null
  tjmMax: number | null
  url: string | null
  notes: string | null
  companyName: string | null
  intermediaryName: string | null
  intermediaryType: string | null
  /** Liste complète des contacts de la piste (identifiants du carnet). */
  contactIds: number[]
  tags: string[]
}

export type RefLists = {
  PLATFORM: string[]
  CONTRACT_TYPE: string[]
  CHANNEL: string[]
  INTERMEDIARY_TYPE: string[]
  INTERVIEW_TYPE: string[]
}
