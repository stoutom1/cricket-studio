-- Align Prisma migration history with Match venue columns.
-- Safe if one or both columns already exist.

ALTER TABLE "Match"
ADD COLUMN IF NOT EXISTS "venueName" TEXT;

ALTER TABLE "Match"
ADD COLUMN IF NOT EXISTS "venueAddress" TEXT;