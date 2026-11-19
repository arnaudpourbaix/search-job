-- AlterTable
ALTER TABLE "Opportunity" ADD COLUMN     "snoozedUntil" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "staleDays" INTEGER NOT NULL DEFAULT 14;
