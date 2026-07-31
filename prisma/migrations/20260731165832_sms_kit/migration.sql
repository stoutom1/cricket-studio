-- AlterTable
ALTER TABLE "KitReminderLog" ADD COLUMN     "fallbackSmsAllowed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "fallbackSmsAttemptedAt" TIMESTAMP(3),
ADD COLUMN     "fallbackSmsBody" TEXT,
ADD COLUMN     "fallbackSmsError" TEXT,
ADD COLUMN     "fallbackSmsMessageId" TEXT,
ADD COLUMN     "fallbackSmsQueuedAt" TIMESTAMP(3),
ADD COLUMN     "fallbackSmsStatus" TEXT;
