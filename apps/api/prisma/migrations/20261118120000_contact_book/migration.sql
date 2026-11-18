-- Carnet de contacts : plusieurs contacts par piste, contact facultatif sur un échange.

-- AlterTable
ALTER TABLE "Contact" ADD COLUMN     "title" TEXT;

-- AlterTable
ALTER TABLE "Interaction" ADD COLUMN     "contactId" INTEGER;

-- CreateTable
CREATE TABLE "OpportunityContact" (
    "opportunityId" INTEGER NOT NULL,
    "contactId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OpportunityContact_pkey" PRIMARY KEY ("opportunityId","contactId")
);

-- Reprise : le contact unique de chaque piste devient son premier contact.
INSERT INTO "OpportunityContact" ("opportunityId", "contactId")
SELECT "id", "contactId" FROM "Opportunity" WHERE "contactId" IS NOT NULL;

-- DropForeignKey
ALTER TABLE "Opportunity" DROP CONSTRAINT "Opportunity_contactId_fkey";

-- AlterTable
ALTER TABLE "Opportunity" DROP COLUMN "contactId";

-- CreateIndex
CREATE INDEX "OpportunityContact_contactId_idx" ON "OpportunityContact"("contactId");

-- CreateIndex
CREATE INDEX "Contact_name_idx" ON "Contact"("name");

-- CreateIndex
CREATE INDEX "Interaction_contactId_idx" ON "Interaction"("contactId");

-- AddForeignKey
ALTER TABLE "OpportunityContact" ADD CONSTRAINT "OpportunityContact_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityContact" ADD CONSTRAINT "OpportunityContact_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interaction" ADD CONSTRAINT "Interaction_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
