-- CreateTable
CREATE TABLE "PlayerMilestone" (
    "id" SERIAL NOT NULL,
    "leagueId" INTEGER NOT NULL,
    "matchId" INTEGER,
    "ballId" INTEGER,
    "representativePlayerId" INTEGER NOT NULL,
    "identityKey" TEXT NOT NULL,
    "playerName" TEXT NOT NULL,
    "playerIds" INTEGER[],
    "milestoneType" TEXT NOT NULL,
    "milestoneValue" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT NOT NULL DEFAULT '🏆',
    "achievedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "dedupeKey" TEXT NOT NULL,
    "metadata" JSONB,

    CONSTRAINT "PlayerMilestone_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlayerMilestone_dedupeKey_key"
ON "PlayerMilestone"("dedupeKey");

CREATE INDEX "PlayerMilestone_leagueId_identityKey_isActive_achievedAt_idx"
ON "PlayerMilestone"("leagueId", "identityKey", "isActive", "achievedAt");

CREATE INDEX "PlayerMilestone_matchId_idx"
ON "PlayerMilestone"("matchId");

CREATE INDEX "PlayerMilestone_representativePlayerId_idx"
ON "PlayerMilestone"("representativePlayerId");
