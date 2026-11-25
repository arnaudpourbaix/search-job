-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'NO_RESPONSE';

-- Le report de relance devient la date de relance prévue de la piste.
ALTER TABLE "Opportunity" RENAME COLUMN "snoozedUntil" TO "followUpAt";
ALTER TABLE "Opportunity" ADD COLUMN "followUpSetOn" TIMESTAMP(3),
ADD COLUMN "responseDueAt" TIMESTAMP(3),
ADD COLUMN "responseDueSetOn" TIMESTAMP(3);

-- Un report en cours reste valable jusqu'au prochain contact.
UPDATE "Opportunity" SET "followUpSetOn" = date_trunc('day', now() AT TIME ZONE 'UTC')
WHERE "followUpAt" IS NOT NULL;

-- Relance sans réponse : compte comme relance faite, pas comme réponse.
ALTER TABLE "Interaction" ADD COLUMN "answered" BOOLEAN NOT NULL DEFAULT true;

-- Silence prolongé avant de proposer la clôture.
ALTER TABLE "User" ADD COLUMN "silenceDays" INTEGER NOT NULL DEFAULT 30;

-- Étape « Sans suite » (perdue) : pas de réponse, sans refus ni abandon.
INSERT INTO "PipelineStage" ("label", "color", "order", "kind", "userId")
SELECT 'Sans suite', 'gray',
  COALESCE((SELECT MAX(p."order") FROM "PipelineStage" p WHERE p."userId" = u."id"), -1) + 1,
  'LOST', u."id"
FROM "User" u
WHERE NOT EXISTS (
  SELECT 1 FROM "PipelineStage" p WHERE p."userId" = u."id" AND p."label" = 'Sans suite'
);
