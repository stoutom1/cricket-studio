-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "BirthdayReminderType" ADD VALUE 'WEB_PUSH';
ALTER TYPE "BirthdayReminderType" ADD VALUE 'WHATSAPP';

-- AlterTable
ALTER TABLE "BirthdayReminderLog" ADD COLUMN     "providerMessageId" TEXT,
ADD COLUMN     "providerStatus" TEXT,
ADD COLUMN     "recipientPhone" TEXT;
