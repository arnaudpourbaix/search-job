-- CreateTable
CREATE TABLE "StageChange" (
    "id" SERIAL NOT NULL,
    "fromLabel" TEXT,
    "toLabel" TEXT NOT NULL,
    "auto" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "opportunityId" INTEGER NOT NULL,

    CONSTRAINT "StageChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StageChange_opportunityId_createdAt_idx" ON "StageChange"("opportunityId", "createdAt");

-- AddForeignKey
ALTER TABLE "StageChange" ADD CONSTRAINT "StageChange_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
