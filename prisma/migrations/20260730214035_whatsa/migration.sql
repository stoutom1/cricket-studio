-- AlterTable
ALTER TABLE "BirthdayReminderLog" ADD COLUMN     "callbackExpectedAt" TIMESTAMP(3),
ADD COLUMN     "callbackReceivedAt" TIMESTAMP(3),
ADD COLUMN     "lastAttemptAt" TIMESTAMP(3),
ADD COLUMN     "lastCallbackAt" TIMESTAMP(3),
ADD COLUMN     "lastErrorCode" TEXT,
ADD COLUMN     "nextRetryAt" TIMESTAMP(3),
ADD COLUMN     "providerResponse" JSONB,
ADD COLUMN     "retryCount" INTEGER NOT NULL DEFAULT 0;
