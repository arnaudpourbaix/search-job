import type { Prisma } from '../generated/prisma/client.js';
import { DEFAULT_STAGES } from '../common/stages.js';

/** Listes proposées à un nouvel utilisateur (modifiables ensuite dans les paramètres). */
export const DEFAULT_LISTS: Record<string, string[]> = {
  PLATFORM: [
    'LinkedIn',
    'Malt',
    'Free-Work',
    'Welcome to the Jungle',
    'Indeed',
  ],
  CONTRACT_TYPE: ['Freelance', 'CDI', 'Portage salarial', 'CDD'],
  CHANNEL: ['Email', 'Téléphone', 'LinkedIn', 'Visio'],
  INTERMEDIARY_TYPE: [
    "Apporteur d'affaires",
    'Société de portage',
    'Cabinet de recrutement',
  ],
  INTERVIEW_TYPE: [
    'Échange client',
    'Entretien RH',
    'Entretien technique',
    'Test',
    'Entretien manager',
    'Entretien final',
  ],
};

/** Étapes du pipeline et listes de départ d'un nouvel utilisateur. */
export async function seedUserDefaults(
  tx: Prisma.TransactionClient,
  userId: number,
) {
  await tx.pipelineStage.createMany({
    data: DEFAULT_STAGES.map((s, order) => ({
      userId,
      label: s.label,
      color: s.color,
      kind: s.kind,
      order,
    })),
  });
  await tx.refList.createMany({
    data: Object.entries(DEFAULT_LISTS).flatMap(([category, values]) =>
      values.map((value, order) => ({ userId, category, value, order })),
    ),
  });
}
