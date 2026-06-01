-- 1. Create League table
CREATE TABLE "League" (
    "id" SERIAL PRIMARY KEY,
    "name" TEXT NOT NULL
);

-- 2. Add leagueId column to Team
ALTER TABLE "Team"
ADD COLUMN "leagueId" INTEGER;

-- 3. Create default league
INSERT INTO "League" ("name")
VALUES ('Default League');

-- 4. Assign all existing teams
UPDATE "Team"
SET "leagueId" = (
    SELECT id
    FROM "League"
    WHERE name = 'Default League'
    LIMIT 1
);

-- 5. Add foreign key
ALTER TABLE "Team"
ADD CONSTRAINT "Team_leagueId_fkey"
FOREIGN KEY ("leagueId")
REFERENCES "League"("id")
ON DELETE SET NULL;