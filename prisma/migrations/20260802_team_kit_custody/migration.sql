CREATE TABLE IF NOT EXISTS "TeamKitState" (
  "id" SERIAL PRIMARY KEY,
  "leagueId" INTEGER NOT NULL,
  "scopeKey" TEXT NOT NULL,
  "teamId" INTEGER,
  "currentHolderPlayerId" INTEGER,
  "currentHolderName" TEXT,
  "lastMatchId" INTEGER,
  "recordedByUserId" INTEGER,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TeamKitState_league_scope_key" UNIQUE ("leagueId", "scopeKey")
);

CREATE INDEX IF NOT EXISTS "TeamKitState_leagueId_idx"
  ON "TeamKitState" ("leagueId");
CREATE INDEX IF NOT EXISTS "TeamKitState_teamId_idx"
  ON "TeamKitState" ("teamId");

CREATE TABLE IF NOT EXISTS "TeamKitCustodyTask" (
  "id" SERIAL PRIMARY KEY,
  "leagueId" INTEGER NOT NULL,
  "scopeKey" TEXT NOT NULL,
  "teamId" INTEGER,
  "matchId" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  "resolvedByUserId" INTEGER,
  CONSTRAINT "TeamKitCustodyTask_match_scope_key" UNIQUE ("matchId", "scopeKey")
);

CREATE INDEX IF NOT EXISTS "TeamKitCustodyTask_league_status_idx"
  ON "TeamKitCustodyTask" ("leagueId", "status");
CREATE INDEX IF NOT EXISTS "TeamKitCustodyTask_teamId_idx"
  ON "TeamKitCustodyTask" ("teamId");

CREATE TABLE IF NOT EXISTS "TeamKitCustodyEvent" (
  "id" SERIAL PRIMARY KEY,
  "leagueId" INTEGER NOT NULL,
  "scopeKey" TEXT NOT NULL,
  "teamId" INTEGER,
  "matchId" INTEGER,
  "holderPlayerId" INTEGER,
  "holderName" TEXT,
  "previousHolderName" TEXT,
  "action" TEXT NOT NULL DEFAULT 'RECORDED',
  "note" TEXT,
  "recordedByUserId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "TeamKitCustodyEvent_league_created_idx"
  ON "TeamKitCustodyEvent" ("leagueId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "TeamKitCustodyEvent_team_created_idx"
  ON "TeamKitCustodyEvent" ("teamId", "createdAt" DESC);

CREATE TABLE IF NOT EXISTS "TeamKitUserAccess" (
  "id" SERIAL PRIMARY KEY,
  "leagueId" INTEGER NOT NULL,
  "userId" INTEGER NOT NULL,
  "teamId" INTEGER NOT NULL,
  "canView" BOOLEAN NOT NULL DEFAULT TRUE,
  "canRecord" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TeamKitUserAccess_user_team_key" UNIQUE ("leagueId", "userId", "teamId")
);

CREATE INDEX IF NOT EXISTS "TeamKitUserAccess_league_user_idx"
  ON "TeamKitUserAccess" ("leagueId", "userId");
