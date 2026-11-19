import type { Prisma } from '../generated/prisma/client.js';
import { StageKind } from '../generated/prisma/enums.js';

/** Natures d'étape qui clôturent une piste (plus de notifications, masquée des actives). */
export const CLOSED_KINDS: StageKind[] = [StageKind.WON, StageKind.LOST];

/** Filtre Prisma : pistes non clôturées. */
export const openStageFilter = {
  stage: { kind: { notIn: CLOSED_KINDS } },
} satisfies Prisma.OpportunityWhereInput;

/** Ce que le front reçoit d'une étape. */
export const stageRef = {
  select: { id: true, label: true, color: true, kind: true },
} as const;

/**
 * Étapes de départ d'un nouvel utilisateur (la migration d'origine les a créées, avec
 * « Entretien client » au lieu de « Entretiens »), avec un code stable.
 * L'ordre du tableau est l'ordre d'affichage.
 */
export const DEFAULT_STAGES = [
  {
    code: 'TO_CONTACT',
    label: 'À contacter',
    color: 'gray',
    kind: StageKind.OPEN,
  },
  {
    code: 'RECRUITER_TALK',
    label: 'Échange recruteur',
    color: 'blue',
    kind: StageKind.OPEN,
  },
  {
    code: 'APPLICATION_SENT',
    label: 'Dossier envoyé',
    color: 'indigo',
    kind: StageKind.OPEN,
  },
  {
    code: 'CLIENT_INTERVIEW',
    // La piste y passe d'elle-même au premier entretien du processus de recrutement.
    label: 'Entretiens',
    color: 'violet',
    kind: StageKind.ADVANCED,
  },
  {
    code: 'OFFER',
    label: 'Proposition',
    color: 'teal',
    kind: StageKind.ADVANCED,
  },
  { code: 'WON', label: 'Gagné', color: 'green', kind: StageKind.WON },
  { code: 'REJECTED', label: 'Refusé', color: 'red', kind: StageKind.LOST },
  {
    code: 'ABANDONED',
    label: 'Abandonné',
    color: 'dark',
    kind: StageKind.LOST,
  },
] as const;

export type StageCode = (typeof DEFAULT_STAGES)[number]['code'];
