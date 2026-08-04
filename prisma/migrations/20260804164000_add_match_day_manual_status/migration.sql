CREATE TABLE "MatchDayManualStatus" (
  "id" SERIAL NOT NULL,
  "leagueId" INTEGER NOT NULL,
  "matchId" INTEGER NOT NULL,
  "availabilityComplete" BOOLEAN NOT NULL DEFAULT false,
  "availabilityNote" TEXT,
  "completedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "MatchDayManualStatus_pkey"
    PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX
  "MatchDayManualStatus_matchId_key"
ON "MatchDayManualStatus"(
  "matchId"
);

CREATE INDEX
  "MatchDayManualStatus_leagueId_updatedAt_idx"
ON "MatchDayManualStatus"(
  "leagueId",
  "updatedAt"
);

CREATE INDEX
  "MatchDayManualStatus_completedByUserId_idx"
ON "MatchDayManualStatus"(
  "completedByUserId"
);
