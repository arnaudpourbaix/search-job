export const STAGES = [
  'TO_CONTACT',
  'RECRUITER_TALK',
  'APPLICATION_SENT',
  'CLIENT_INTERVIEW',
  'OFFER',
  'WON',
  'REJECTED',
  'ABANDONED',
] as const

export type Stage = (typeof STAGES)[number]

export type Ref = { id: number; name: string }

export type ContactRef = {
  id: number
  name: string
  email: string | null
  phone: string | null
}

/** Dates « jour » au format YYYY-MM-DD. */
export type Day = string

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
  contact: ContactRef | null
  tags: string[]
  firstContactAt: Day | null
  lastContactAt: Day | null
  nextAction: NextAction | null
  openActions: number
  /** Même entreprise proposée sur plusieurs pistes. */
  duplicateCompany: boolean
  updatedAt: string
}

export type Interaction = {
  id: number
  date: Day
  channel: string | null
  summary: string
}

export type Action = {
  id: number
  label: string
  dueDate: Day | null
  doneAt: string | null
}

export type OpportunityDetail = Omit<OpportunitySummary, 'openActions'> & {
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
  stage: Stage
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
  contact: { name: string; email: string | null; phone: string | null } | null
  tags: string[]
}

export type RefLists = {
  PLATFORM: string[]
  CONTRACT_TYPE: string[]
  CHANNEL: string[]
  INTERMEDIARY_TYPE: string[]
}
