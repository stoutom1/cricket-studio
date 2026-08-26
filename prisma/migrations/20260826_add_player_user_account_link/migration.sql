-- Add a persistent Cric4All account link to Player.
-- This does not modify or delete any historical match/statistics data.

ALTER TABLE "Player"
ADD COLUMN "userId" TEXT;

CREATE INDEX "Player_userId_idx"
ON "Player"("userId");

ALTER TABLE "Player"
ADD CONSTRAINT "Player_userId_fkey"
FOREIGN KEY ("userId")
REFERENCES "User"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
