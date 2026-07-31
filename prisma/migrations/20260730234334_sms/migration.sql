-- AlterTable
ALTER TABLE "LeagueBirthday" ADD COLUMN     "smsOptIn" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "smsOptInAt" TIMESTAMP(3),
ADD COLUMN     "smsOptInIpAddress" TEXT,
ADD COLUMN     "smsOptInSource" TEXT,
ADD COLUMN     "smsOptInUserAgent" TEXT,
ADD COLUMN     "smsOptOutAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Player" ADD COLUMN     "smsOptIn" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "smsOptInAt" TIMESTAMP(3),
ADD COLUMN     "smsOptInIpAddress" TEXT,
ADD COLUMN     "smsOptInSource" TEXT,
ADD COLUMN     "smsOptInUserAgent" TEXT,
ADD COLUMN     "smsOptOutAt" TIMESTAMP(3);
