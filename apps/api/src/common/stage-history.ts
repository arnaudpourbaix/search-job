import type { Prisma } from '../generated/prisma/client.js';

/**
 * Trace un changement d'étape dans l'historique de la piste, avec les libellés du
 * moment. `fromStageId` null : création de la piste. Rien n'est tracé si l'étape
 * ne change pas.
 */
export async function recordStageChange(
  tx: Prisma.TransactionClient,
  opportunityId: number,
  fromStageId: number | null,
  toStageId: number,
  auto = false,
) {
  if (fromStageId === toStageId) return;
  const ids = fromStageId === null ? [toStageId] : [fromStageId, toStageId];
  const stages = await tx.pipelineStage.findMany({
    where: { id: { in: ids } },
    select: { id: true, label: true },
  });
  const label = (id: number) => stages.find((s) => s.id === id)?.label ?? '?';
  await tx.stageChange.create({
    data: {
      opportunityId,
      fromLabel: fromStageId === null ? null : label(fromStageId),
      toLabel: label(toStageId),
      auto,
    },
  });
}

/** Historique d'étape d'une piste, du plus récent au plus ancien. */
export const stageChangesInclude = {
  orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  select: {
    id: true,
    fromLabel: true,
    toLabel: true,
    auto: true,
    createdAt: true,
  },
} satisfies Prisma.Opportunity$stageChangesArgs;
