-- Growth Phase 7: league follower match alerts.

ALTER TABLE "LeagueFollower"
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "alertsEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "alertMatchStart" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "alertMatchResult" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX "LeagueFollower_leagueId_alertsEnabled_idx"
ON "LeagueFollower"("leagueId", "alertsEnabled");

CREATE TABLE "LeagueAlertDelivery" (
  "id" SERIAL NOT NULL,
  "userId" TEXT NOT NULL,
  "leagueId" INTEGER NOT NULL,
  "matchId" INTEGER NOT NULL,
  "alertType" TEXT NOT NULL,
  "deliveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "LeagueAlertDelivery_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LeagueAlertDelivery_userId_matchId_alertType_key"
ON "LeagueAlertDelivery"("userId", "matchId", "alertType");

CREATE INDEX "LeagueAlertDelivery_leagueId_deliveredAt_idx"
ON "LeagueAlertDelivery"("leagueId", "deliveredAt");

CREATE INDEX "LeagueAlertDelivery_userId_deliveredAt_idx"
ON "LeagueAlertDelivery"("userId", "deliveredAt");

CREATE INDEX "LeagueAlertDelivery_matchId_alertType_idx"
ON "LeagueAlertDelivery"("matchId", "alertType");
