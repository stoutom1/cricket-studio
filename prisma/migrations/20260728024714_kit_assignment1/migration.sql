/*
  Warnings:

  - A unique constraint covering the columns `[assignmentId,reminderType,channel,recipientType]` on the table `KitReminderLog` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `reminderType` to the `KitReminderLog` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "KitReminderType" AS ENUM ('DAY_BEFORE', 'TWO_HOURS_BEFORE', 'ASSIGNMENT_CHANGED');

-- CreateEnum
CREATE TYPE "KitReminderChannel" AS ENUM ('WHATSAPP', 'PUSH');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "KitReminderRecipientType" ADD VALUE 'CAPTAIN';
ALTER TYPE "KitReminderRecipientType" ADD VALUE 'TEAM_MANAGER';
ALTER TYPE "KitReminderRecipientType" ADD VALUE 'SCORER';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "KitReminderStatus" ADD VALUE 'PROCESSING';
ALTER TYPE "KitReminderStatus" ADD VALUE 'SKIPPED';

-- DropIndex
DROP INDEX "KitReminderLog_assignmentId_recipientType_key";

-- AlterTable
ALTER TABLE "KitReminderLog" ADD COLUMN     "attemptCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "channel" "KitReminderChannel" NOT NULL DEFAULT 'WHATSAPP',
ADD COLUMN     "failedAt" TIMESTAMP(3),
ADD COLUMN     "leagueId" INTEGER,
ADD COLUMN     "matchId" INTEGER,
ADD COLUMN     "processingStartedAt" TIMESTAMP(3),
ADD COLUMN     "providerResponse" JSONB,
ADD COLUMN     "reminderType" "KitReminderType" NOT NULL,
ADD COLUMN     "teamId" INTEGER;

-- AlterTable
ALTER TABLE "League" ADD COLUMN     "timeZone" TEXT NOT NULL DEFAULT 'America/Los_Angeles';

-- CreateIndex
CREATE UNIQUE INDEX "KitReminderLog_assignmentId_reminderType_channel_recipientT_key" ON "KitReminderLog"("assignmentId", "reminderType", "channel", "recipientType");

-- AddForeignKey
ALTER TABLE "KitReminderLog" ADD CONSTRAINT "KitReminderLog_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KitReminderLog" ADD CONSTRAINT "KitReminderLog_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KitReminderLog" ADD CONSTRAINT "KitReminderLog_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE SET NULL ON UPDATE CASCADE;
