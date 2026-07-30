-- AlterTable
ALTER TABLE "User" ADD COLUMN     "smsConsentIp" TEXT,
ADD COLUMN     "smsConsentSource" TEXT,
ADD COLUMN     "smsConsentText" TEXT,
ADD COLUMN     "smsConsentUserAgent" TEXT,
ADD COLUMN     "smsOptIn" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "smsOptInAt" TIMESTAMP(3),
ADD COLUMN     "smsOptOutAt" TIMESTAMP(3),
ADD COLUMN     "smsPhoneNumber" TEXT;
