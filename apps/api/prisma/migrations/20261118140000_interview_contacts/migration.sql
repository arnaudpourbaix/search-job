-- Interlocuteurs des entretiens (contacts du carnet).

-- CreateTable
CREATE TABLE "InterviewContact" (
    "interviewId" INTEGER NOT NULL,
    "contactId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InterviewContact_pkey" PRIMARY KEY ("interviewId","contactId")
);

-- CreateIndex
CREATE INDEX "InterviewContact_contactId_idx" ON "InterviewContact"("contactId");

-- AddForeignKey
ALTER TABLE "InterviewContact" ADD CONSTRAINT "InterviewContact_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "Interview"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewContact" ADD CONSTRAINT "InterviewContact_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

