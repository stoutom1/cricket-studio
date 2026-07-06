-- CreateTable
CREATE TABLE "MatchCorrection" (
    "id" SERIAL NOT NULL,
    "matchId" INTEGER NOT NULL,
    "leagueId" INTEGER,
    "correctionType" TEXT NOT NULL,
    "correctionLabel" TEXT,
    "beforeJson" JSONB NOT NULL,
    "afterJson" JSONB NOT NULL,
    "reason" TEXT,
    "correctedById" INTEGER,
    "correctedByName" TEXT,
    "correctedByEmail" TEXT,
    "rolledBackAt" TIMESTAMP(3),
    "rolledBackById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchCorrection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MatchCorrection_matchId_idx" ON "MatchCorrection"("matchId");

-- CreateIndex
CREATE INDEX "MatchCorrection_leagueId_idx" ON "MatchCorrection"("leagueId");

-- CreateIndex
CREATE INDEX "MatchCorrection_correctionType_idx" ON "MatchCorrection"("correctionType");

-- CreateIndex
CREATE INDEX "MatchCorrection_createdAt_idx" ON "MatchCorrection"("createdAt");
