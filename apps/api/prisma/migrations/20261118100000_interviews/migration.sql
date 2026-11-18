-- CreateEnum
CREATE TYPE "InterviewStatus" AS ENUM ('PLANNED', 'DONE', 'PASSED', 'FAILED');

-- CreateTable
CREATE TABLE "Interview" (
    "id" SERIAL NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "type" TEXT NOT NULL,
    "label" TEXT,
    "date" TIMESTAMP(3),
    "time" TEXT,
    "status" "InterviewStatus" NOT NULL DEFAULT 'PLANNED',
    "notes" TEXT,
    "opportunityId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Interview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Interview_opportunityId_order_idx" ON "Interview"("opportunityId", "order");

-- CreateIndex
CREATE INDEX "Interview_date_idx" ON "Interview"("date");

-- AddForeignKey
ALTER TABLE "Interview" ADD CONSTRAINT "Interview_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Types de tour proposés (modifiables dans les paramètres)
INSERT INTO "RefList" ("category", "value", "order") VALUES
    ('INTERVIEW_TYPE', 'Échange client', 0),
    ('INTERVIEW_TYPE', 'Entretien RH', 1),
    ('INTERVIEW_TYPE', 'Entretien technique', 2),
    ('INTERVIEW_TYPE', 'Test', 3),
    ('INTERVIEW_TYPE', 'Entretien manager', 4),
    ('INTERVIEW_TYPE', 'Entretien final', 5)
ON CONFLICT ("category", "value") DO NOTHING;
