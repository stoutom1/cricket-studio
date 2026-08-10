-- Add permanent/default team roles.
ALTER TABLE "Team"
ADD COLUMN "defaultCaptainId" INTEGER,
ADD COLUMN "defaultViceCaptainId" INTEGER,
ADD COLUMN "defaultWicketKeeperId" INTEGER;

-- Add match-specific vice-captain assignments.
ALTER TABLE "Match"
ADD COLUMN "teamAViceCaptainId" INTEGER,
ADD COLUMN "teamBViceCaptainId" INTEGER;

-- Team default Captain relation.
ALTER TABLE "Team"
ADD CONSTRAINT "Team_defaultCaptainId_fkey"
FOREIGN KEY ("defaultCaptainId")
REFERENCES "Player"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

-- Team default Vice-Captain relation.
ALTER TABLE "Team"
ADD CONSTRAINT "Team_defaultViceCaptainId_fkey"
FOREIGN KEY ("defaultViceCaptainId")
REFERENCES "Player"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

-- Team default Wicketkeeper relation.
ALTER TABLE "Team"
ADD CONSTRAINT "Team_defaultWicketKeeperId_fkey"
FOREIGN KEY ("defaultWicketKeeperId")
REFERENCES "Player"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;