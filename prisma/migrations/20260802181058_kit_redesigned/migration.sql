-- DropIndex
DROP INDEX "TeamKitCustodyEvent_league_created_idx";

-- DropIndex
DROP INDEX "TeamKitCustodyEvent_team_created_idx";

-- CreateIndex
CREATE INDEX "TeamKitCustodyEvent_leagueId_createdAt_idx" ON "TeamKitCustodyEvent"("leagueId", "createdAt");

-- CreateIndex
CREATE INDEX "TeamKitCustodyEvent_teamId_createdAt_idx" ON "TeamKitCustodyEvent"("teamId", "createdAt");

-- RenameIndex
ALTER INDEX "TeamKitCustodyTask_league_status_idx" RENAME TO "TeamKitCustodyTask_leagueId_status_idx";

-- RenameIndex
ALTER INDEX "TeamKitUserAccess_league_user_idx" RENAME TO "TeamKitUserAccess_leagueId_userId_idx";
