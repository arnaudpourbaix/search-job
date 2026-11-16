/**
 * Conversion des lignes de l'ancien fichier Excel (onglet « Pistes ») vers le
 * modèle de données. Fonctions pures : aucune dépendance à Prisma ni à exceljs.
 */
import { Stage } from '../generated/prisma/enums.js';

/** Statuts considérés comme clôturés. */
export const CLOSED_STAGES: readonly Stage[] = [
  Stage.WON,
  Stage.REJECTED,
  Stage.ABANDONED,
];

const STAGE_BY_LABEL: Record<string, Stage> = {
  'a contacter': Stage.TO_CONTACT,
  'echange recruteur': Stage.RECRUITER_TALK,
  'dossier envoye': Stage.APPLICATION_SENT,
  'entretien client': Stage.CLIENT_INTERVIEW,
  proposition: Stage.OFFER,
  gagne: Stage.WON,
  refuse: Stage.REJECTED,
  abandonne: Stage.ABANDONED,
};

/** Canaux connus (liste « Canal ») ; une plateforme qui y figure sert de canal. */
const CHANNELS = ['Téléphone', 'Mail', 'LinkedIn', 'Visio', 'Présentiel'];

/** Minuscules, sans accents ni espaces superflus : sert à comparer les libellés. */
export function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Texte nettoyé, ou null si vide / inconnu (« ??? »). */
export function cleanText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  // Espaces multiples réduits à un seul ; les retours à la ligne sont conservés.
  const text = String(value)
    .replace(/[ \t]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .trim();
  if (text === '' || /^\?+$/.test(text)) return null;
  return text;
}

export function toInt(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.round(value);
  }
  const text = cleanText(value);
  if (!text) return null;
  const n = Number(text.replace(/[\s€]/g, '').replace(',', '.'));
  return Number.isFinite(n) ? Math.round(n) : null;
}

/** Date « jour » à minuit UTC, ou null. */
export function toDay(value: unknown): Date | null {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return null;
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
  );
}

export function parseStage(value: unknown): Stage {
  const text = cleanText(value);
  if (!text) return Stage.TO_CONTACT;
  const stage = STAGE_BY_LABEL[normalize(text)];
  if (!stage) throw new Error(`Étape inconnue : « ${text} »`);
  return stage;
}

/** « Java / Angular, NestJS » → ['Java', 'Angular', 'NestJS']. */
export function parseStack(value: unknown): string[] {
  const text = cleanText(value);
  if (!text) return [];
  const seen = new Set<string>();
  return text
    .split(/[/,;+]/)
    .map((t) => t.trim())
    .filter((t) => {
      const key = normalize(t);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function channelFromPlatform(platform: string | null): string | null {
  if (!platform) return null;
  return CHANNELS.find((c) => normalize(c) === normalize(platform)) ?? null;
}

/** Cellule « hyperlien » telle que fournie par exceljs. */
export type LinkCell = { text?: unknown; hyperlink?: string } | string | null;

export type RawRow = {
  label: unknown;
  company: unknown;
  client: unknown;
  contactName: unknown;
  email: unknown;
  phone: unknown;
  platform: unknown;
  contractType: unknown;
  title: unknown;
  stack: unknown;
  location: unknown;
  remoteDays: unknown;
  duration: unknown;
  salaryMin: unknown;
  salaryMax: unknown;
  tjm: unknown;
  stage: unknown;
  firstContact: unknown;
  lastContact: unknown;
  nextAction: unknown;
  nextActionDate: unknown;
  link: LinkCell;
  notes: unknown;
};

export type MappedOpportunity = {
  label: string;
  /** Intermédiaire (ESN, cabinet) ou employeur direct. */
  companyName: string | null;
  /** Client final, si différent de la société. */
  clientName: string | null;
  contact: { name: string; email: string | null; phone: string | null } | null;
  platform: string | null;
  contractType: string | null;
  title: string | null;
  tags: string[];
  location: string | null;
  remoteDays: number | null;
  duration: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  tjmMin: number | null;
  tjmMax: number | null;
  stage: Stage;
  url: string | null;
  notes: string | null;
  interactions: { date: Date; channel: string | null; summary: string }[];
  action: { label: string; dueDate: Date | null; done: boolean } | null;
};

const RANGE = /^\s*(\d{2,5})\s*[-–à]\s*(\d{2,5})\s*$/;

export function mapRow(row: RawRow): MappedOpportunity {
  const label = cleanText(row.label);
  if (!label) throw new Error('Ligne sans nom de piste');

  const stage = parseStage(row.stage);
  const platform = cleanText(row.platform);
  const channel = channelFromPlatform(platform);

  // « Direct » : pas d'intermédiaire, la société est le client final.
  let companyName = cleanText(row.company);
  let clientName = cleanText(row.client);
  if (companyName && normalize(companyName) === 'direct') {
    companyName = clientName;
    clientName = null;
  }
  if (
    clientName &&
    companyName &&
    normalize(clientName) === normalize(companyName)
  ) {
    clientName = null;
  }

  // TJM : valeur unique, ou fourchette « 500-600 » saisie dans les notes.
  const noteLines: string[] = [];
  let tjmMin = toInt(row.tjm);
  let tjmMax = tjmMin;
  const notes = cleanText(row.notes);
  const range = notes?.match(RANGE);
  if (range) {
    tjmMin = Number(range[1]);
    tjmMax = Number(range[2]);
  } else if (notes) {
    noteLines.push(notes);
  }

  // Lien : hyperlien → url ; texte libre → conservé dans les notes.
  let url: string | null = null;
  const link = row.link;
  const linkText =
    typeof link === 'object' && link !== null
      ? cleanText(link.text)
      : cleanText(link);
  if (typeof link === 'object' && link?.hyperlink) {
    url = link.hyperlink;
  } else if (linkText && /^https?:\/\//i.test(linkText)) {
    url = linkText;
  }
  if (linkText && linkText !== url) noteLines.push(`Annonce : ${linkText}`);

  // Journal : 1er et dernier contact deviennent des échanges.
  const interactions: MappedOpportunity['interactions'] = [];
  const first = toDay(row.firstContact);
  const last = toDay(row.lastContact);
  if (first) {
    interactions.push({
      date: first,
      channel,
      summary: 'Premier contact (import Excel)',
    });
  }
  if (last && (!first || last.getTime() !== first.getTime())) {
    interactions.push({
      date: last,
      channel,
      summary: 'Dernier contact (import Excel)',
    });
  }

  // Prochaine action : marquée faite si la piste est clôturée.
  const actionLabel = cleanText(row.nextAction);
  const action = actionLabel
    ? {
        label: actionLabel,
        dueDate: toDay(row.nextActionDate),
        done: CLOSED_STAGES.includes(stage),
      }
    : null;

  const contactName = cleanText(row.contactName);

  return {
    label,
    companyName,
    clientName,
    contact: contactName
      ? {
          name: contactName,
          email: cleanText(row.email),
          phone: cleanText(row.phone),
        }
      : null,
    platform,
    contractType: cleanText(row.contractType),
    title: cleanText(row.title),
    tags: parseStack(row.stack),
    location: cleanText(row.location),
    remoteDays: toInt(row.remoteDays),
    duration: cleanText(row.duration),
    salaryMin: toInt(row.salaryMin),
    salaryMax: toInt(row.salaryMax),
    tjmMin,
    tjmMax,
    stage,
    url,
    notes: noteLines.length ? noteLines.join('\n') : null,
    interactions,
    action,
  };
}
