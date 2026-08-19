CREATE TABLE "GrowthEvent" (
    "id" BIGSERIAL NOT NULL,
    "eventType" TEXT NOT NULL,
    "visitorId" TEXT,
    "sessionId" TEXT,
    "userId" TEXT,
    "leagueId" INTEGER,
    "matchId" INTEGER,
    "source" TEXT,
    "path" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GrowthEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "GrowthEvent_eventType_createdAt_idx" ON "GrowthEvent"("eventType", "createdAt");
CREATE INDEX "GrowthEvent_visitorId_createdAt_idx" ON "GrowthEvent"("visitorId", "createdAt");
CREATE INDEX "GrowthEvent_userId_createdAt_idx" ON "GrowthEvent"("userId", "createdAt");
CREATE INDEX "GrowthEvent_leagueId_createdAt_idx" ON "GrowthEvent"("leagueId", "createdAt");
CREATE INDEX "GrowthEvent_matchId_createdAt_idx" ON "GrowthEvent"("matchId", "createdAt");
