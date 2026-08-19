-- Add real physical match location metadata.
-- Existing matches remain valid because both columns are nullable.

ALTER TABLE "Match"
ADD COLUMN "venueName" TEXT,
ADD COLUMN "venueAddress" TEXT;
