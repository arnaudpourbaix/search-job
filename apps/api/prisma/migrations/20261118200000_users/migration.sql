-- Utilisateurs et sessions (connexion Google), données cloisonnées par utilisateur.

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "googleSub" TEXT,
    "name" TEXT,
    "picture" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_googleSub_key" ON "User"("googleSub");
CREATE INDEX "Session_userId_idx" ON "Session"("userId");
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Compte initial : propriétaire des données existantes. Sans identifiant Google, il
-- est repris à la première connexion de la première adresse de ALLOWED_EMAILS.
INSERT INTO "User" ("email") VALUES ('compte-initial@search-job.local');

-- Colonne userId : ajoutée nullable, remplie avec le compte initial, puis obligatoire.
ALTER TABLE "PipelineStage" ADD COLUMN "userId" INTEGER;
ALTER TABLE "Company" ADD COLUMN "userId" INTEGER;
ALTER TABLE "Contact" ADD COLUMN "userId" INTEGER;
ALTER TABLE "Opportunity" ADD COLUMN "userId" INTEGER;
ALTER TABLE "Campaign" ADD COLUMN "userId" INTEGER;
ALTER TABLE "Tag" ADD COLUMN "userId" INTEGER;
ALTER TABLE "RefList" ADD COLUMN "userId" INTEGER;

UPDATE "PipelineStage" SET "userId" = (SELECT MIN("id") FROM "User");
UPDATE "Company" SET "userId" = (SELECT MIN("id") FROM "User");
UPDATE "Contact" SET "userId" = (SELECT MIN("id") FROM "User");
UPDATE "Opportunity" SET "userId" = (SELECT MIN("id") FROM "User");
UPDATE "Campaign" SET "userId" = (SELECT MIN("id") FROM "User");
UPDATE "Tag" SET "userId" = (SELECT MIN("id") FROM "User");
UPDATE "RefList" SET "userId" = (SELECT MIN("id") FROM "User");

ALTER TABLE "PipelineStage" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "Company" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "Contact" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "Opportunity" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "Campaign" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "Tag" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "RefList" ALTER COLUMN "userId" SET NOT NULL;

-- Unicités désormais par utilisateur.
DROP INDEX "PipelineStage_label_key";
DROP INDEX "Company_name_key";
DROP INDEX "Contact_name_idx";
DROP INDEX "Campaign_name_key";
DROP INDEX "Tag_name_key";
DROP INDEX "RefList_category_value_key";

CREATE UNIQUE INDEX "PipelineStage_userId_label_key" ON "PipelineStage"("userId", "label");
CREATE UNIQUE INDEX "Company_userId_name_key" ON "Company"("userId", "name");
CREATE INDEX "Contact_userId_name_idx" ON "Contact"("userId", "name");
CREATE INDEX "Opportunity_userId_idx" ON "Opportunity"("userId");
CREATE UNIQUE INDEX "Campaign_userId_name_key" ON "Campaign"("userId", "name");
CREATE UNIQUE INDEX "Tag_userId_name_key" ON "Tag"("userId", "name");
CREATE UNIQUE INDEX "RefList_userId_category_value_key" ON "RefList"("userId", "category", "value");

ALTER TABLE "PipelineStage" ADD CONSTRAINT "PipelineStage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Company" ADD CONSTRAINT "Company_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RefList" ADD CONSTRAINT "RefList_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
