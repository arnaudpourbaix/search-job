-- Campagnes de recherche : chaque piste appartient à une campagne.

-- CreateTable
CREATE TABLE "Campaign" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "goal" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Campaign_name_key" ON "Campaign"("name");

-- Pistes existantes : rattachées à une première campagne, démarrée au plus ancien
-- échange (ou à la plus ancienne piste). Rien n'est créé sur une base vide.
INSERT INTO "Campaign" ("name", "goal", "startDate")
SELECT
    'Mission janvier 2027',
    'Mission freelance ou CDI pour un démarrage en janvier 2027',
    date_trunc('day', LEAST(
        (SELECT MIN("date") FROM "Interaction"),
        (SELECT MIN("createdAt") FROM "Opportunity")
    ))
WHERE EXISTS (SELECT 1 FROM "Opportunity");

-- AlterTable : colonne ajoutée nullable, remplie, puis rendue obligatoire.
ALTER TABLE "Opportunity" ADD COLUMN "campaignId" INTEGER;
UPDATE "Opportunity" SET "campaignId" = (SELECT MIN("id") FROM "Campaign");
ALTER TABLE "Opportunity" ALTER COLUMN "campaignId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Opportunity_campaignId_idx" ON "Opportunity"("campaignId");

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
