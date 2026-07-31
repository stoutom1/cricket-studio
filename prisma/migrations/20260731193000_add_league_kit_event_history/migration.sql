-- Create an append-only history for the shared league kit.

CREATE TYPE "LeagueKitEventType" AS ENUM (
  'KIT_CREATED',
  'ASSIGNMENT_CREATED',
  'ASSIGNMENT_CHANGED',
  'COORDINATION_CONFIRMED',
  'HANDOVER_CONFIRMED',
  'VENUE_CONFIRMED',
  'STATUS_RESET',
  'CUSTODY_TRANSFERRED',
  'CUSTODY_NOT_TRANSFERRED'
);

CREATE TABLE "LeagueKitEvent" (
  "id" SERIAL NOT NULL,
  "leagueKitId" INTEGER NOT NULL,
  "leagueId" INTEGER NOT NULL,
  "matchId" INTEGER,
  "assignmentId" INTEGER,
  "eventType" "LeagueKitEventType" NOT NULL,
  "fromHolderRotationMemberId" INTEGER,
  "toHolderRotationMemberId" INTEGER,
  "fromHolderName" TEXT,
  "toHolderName" TEXT,
  "description" TEXT,
  "metadata" JSONB,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "LeagueKitEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LeagueKitEvent_leagueKitId_occurredAt_idx"
ON "LeagueKitEvent"("leagueKitId", "occurredAt");

CREATE INDEX "LeagueKitEvent_leagueId_occurredAt_idx"
ON "LeagueKitEvent"("leagueId", "occurredAt");

CREATE INDEX "LeagueKitEvent_matchId_idx"
ON "LeagueKitEvent"("matchId");

CREATE INDEX "LeagueKitEvent_assignmentId_idx"
ON "LeagueKitEvent"("assignmentId");

CREATE INDEX "LeagueKitEvent_eventType_occurredAt_idx"
ON "LeagueKitEvent"("eventType", "occurredAt");

ALTER TABLE "LeagueKitEvent"
ADD CONSTRAINT "LeagueKitEvent_leagueKitId_fkey"
FOREIGN KEY ("leagueKitId")
REFERENCES "LeagueKit"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "LeagueKitEvent"
ADD CONSTRAINT "LeagueKitEvent_leagueId_fkey"
FOREIGN KEY ("leagueId")
REFERENCES "League"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "LeagueKitEvent"
ADD CONSTRAINT "LeagueKitEvent_matchId_fkey"
FOREIGN KEY ("matchId")
REFERENCES "Match"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

ALTER TABLE "LeagueKitEvent"
ADD CONSTRAINT "LeagueKitEvent_assignmentId_fkey"
FOREIGN KEY ("assignmentId")
REFERENCES "KitAssignment"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
