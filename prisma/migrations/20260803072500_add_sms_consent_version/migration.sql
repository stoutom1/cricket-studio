-- Add the consent-text version recorded when a user opts into SMS.
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "smsConsentVersion" TEXT;