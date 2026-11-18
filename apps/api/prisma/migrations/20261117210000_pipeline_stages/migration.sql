-- Étapes du pipeline configurables : l'enum "Stage" devient la table "PipelineStage".

-- CreateEnum
CREATE TYPE "StageKind" AS ENUM ('OPEN', 'ADVANCED', 'WON', 'LOST');

-- CreateTable
CREATE TABLE "PipelineStage" (
    "id" SERIAL NOT NULL,
    "label" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT 'gray',
    "order" INTEGER NOT NULL DEFAULT 0,
    "kind" "StageKind" NOT NULL DEFAULT 'OPEN',

    CONSTRAINT "PipelineStage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PipelineStage_label_key" ON "PipelineStage"("label");

-- Les 8 étapes d'origine, avec leurs libellés et couleurs.
INSERT INTO "PipelineStage" ("label", "color", "order", "kind") VALUES
    ('À contacter',       'gray',   0, 'OPEN'),
    ('Échange recruteur', 'blue',   1, 'OPEN'),
    ('Dossier envoyé',    'indigo', 2, 'OPEN'),
    ('Entretien client',  'violet', 3, 'ADVANCED'),
    ('Proposition',       'teal',   4, 'ADVANCED'),
    ('Gagné',             'green',  5, 'WON'),
    ('Refusé',            'red',    6, 'LOST'),
    ('Abandonné',         'dark',   7, 'LOST');

-- Pistes : ancienne valeur d'enum → étape correspondante.
ALTER TABLE "Opportunity" ADD COLUMN "stageId" INTEGER;
UPDATE "Opportunity" o SET "stageId" = s."id"
FROM "PipelineStage" s
WHERE s."label" = CASE o."stage"
    WHEN 'TO_CONTACT'       THEN 'À contacter'
    WHEN 'RECRUITER_TALK'   THEN 'Échange recruteur'
    WHEN 'APPLICATION_SENT' THEN 'Dossier envoyé'
    WHEN 'CLIENT_INTERVIEW' THEN 'Entretien client'
    WHEN 'OFFER'            THEN 'Proposition'
    WHEN 'WON'              THEN 'Gagné'
    WHEN 'REJECTED'         THEN 'Refusé'
    WHEN 'ABANDONED'        THEN 'Abandonné'
END;
ALTER TABLE "Opportunity" ALTER COLUMN "stageId" SET NOT NULL;

-- Ancienne colonne et ancien enum.
DROP INDEX "Opportunity_stage_idx";
ALTER TABLE "Opportunity" DROP COLUMN "stage";
DROP TYPE "Stage";

-- CreateIndex
CREATE INDEX "Opportunity_stageId_idx" ON "Opportunity"("stageId");

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "PipelineStage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
