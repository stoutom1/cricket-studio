-- CreateEnum
CREATE TYPE "LeagueKitStatus" AS ENUM (
  'UNASSIGNED',
  'WITH_HOLDER',
  'AWAITING_COORDINATION',
  'HANDOVER_CONFIRMED',
  'AT_VENUE'
);

-- CreateEnum
CREATE TYPE "LeagueKitHandoverStatus" AS ENUM (
  'NOT_REQUIRED',
  'PENDING',
  'COORDINATED',
  'HANDED_OVER'
);

-- CreateTable
CREATE TABLE "LeagueKit" (
  "id" SERIAL NOT NULL,
  "leagueId" INTEGER NOT NULL,
  "name" TEXT NOT NULL DEFAULT 'League Kit',
  "status" "LeagueKitStatus" NOT NULL DEFAULT 'UNASSIGNED',
  "handoverStatus" "LeagueKitHandoverStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
  "currentHolderRotationMemberId" INTEGER,
  "previousHolderRotationMemberId" INTEGER,
  "holderConfirmedAt" TIMESTAMP(3),
  "handoverConfirmedAt" TIMESTAMP(3),
  "venueConfirmedAt" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "LeagueKit_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "KitAssignment"
ADD COLUMN "leagueKitId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "LeagueKit_leagueId_key"
ON "LeagueKit"("leagueId");

-- CreateIndex
CREATE INDEX "LeagueKit_currentHolderRotationMemberId_idx"
ON "LeagueKit"("currentHolderRotationMemberId");

-- CreateIndex
CREATE INDEX "LeagueKit_previousHolderRotationMemberId_idx"
ON "LeagueKit"("previousHolderRotationMemberId");

-- CreateIndex
CREATE INDEX "LeagueKit_status_handoverStatus_idx"
ON "LeagueKit"("status", "handoverStatus");

-- CreateIndex
CREATE INDEX "KitAssignment_leagueKitId_matchId_status_idx"
ON "KitAssignment"("leagueKitId", "matchId", "status");

-- AddForeignKey
ALTER TABLE "LeagueKit"
ADD CONSTRAINT "LeagueKit_leagueId_fkey"
FOREIGN KEY ("leagueId") REFERENCES "League"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeagueKit"
ADD CONSTRAINT "LeagueKit_currentHolderRotationMemberId_fkey"
FOREIGN KEY ("currentHolderRotationMemberId") REFERENCES "KitRotationMember"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeagueKit"
ADD CONSTRAINT "LeagueKit_previousHolderRotationMemberId_fkey"
FOREIGN KEY ("previousHolderRotationMemberId") REFERENCES "KitRotationMember"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KitAssignment"
ADD CONSTRAINT "KitAssignment_leagueKitId_fkey"
FOREIGN KEY ("leagueKitId") REFERENCES "LeagueKit"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
