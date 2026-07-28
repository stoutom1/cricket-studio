-- CreateEnum
CREATE TYPE "KitAssignmentStatus" AS ENUM ('SUGGESTED', 'ASSIGNED', 'CONFIRMED', 'DECLINED', 'COMPLETED', 'MISSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "KitReminderRecipientType" AS ENUM ('PLAYER', 'LEAGUE_OWNER');

-- CreateEnum
CREATE TYPE "KitReminderStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "KitRotationMode" AS ENUM ('TEAM', 'LEAGUE_PLAYER');

-- AlterTable
ALTER TABLE "League" ADD COLUMN     "kitRotationMode" "KitRotationMode" NOT NULL DEFAULT 'TEAM';

-- CreateTable
CREATE TABLE "MatchKitPlayer" (
    "id" SERIAL NOT NULL,
    "matchId" INTEGER NOT NULL,
    "leagueId" INTEGER NOT NULL,
    "teamId" INTEGER NOT NULL,
    "playerId" INTEGER,
    "displayName" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "whatsappNumber" TEXT,
    "whatsappOptIn" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT NOT NULL DEFAULT 'SCREENSHOT',
    "isConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "isEligible" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatchKitPlayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KitRotationMember" (
    "id" SERIAL NOT NULL,
    "leagueId" INTEGER NOT NULL,
    "rotationKey" TEXT NOT NULL,
    "teamId" INTEGER,
    "playerId" INTEGER,
    "displayName" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "whatsappNumber" TEXT,
    "whatsappOptIn" BOOLEAN NOT NULL DEFAULT false,
    "completedCount" INTEGER NOT NULL DEFAULT 0,
    "lastCompletedAt" TIMESTAMP(3),
    "lastAssignedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KitRotationMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KitAssignment" (
    "id" SERIAL NOT NULL,
    "leagueId" INTEGER NOT NULL,
    "matchId" INTEGER NOT NULL,
    "teamId" INTEGER NOT NULL,
    "rotationMemberId" INTEGER NOT NULL,
    "matchKitPlayerId" INTEGER,
    "status" "KitAssignmentStatus" NOT NULL DEFAULT 'SUGGESTED',
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),
    "declinedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "missedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "assignedById" TEXT,
    "assignmentReason" TEXT,
    "responseNote" TEXT,
    "ownerNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KitAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KitReminderLog" (
    "id" SERIAL NOT NULL,
    "assignmentId" INTEGER NOT NULL,
    "recipientType" "KitReminderRecipientType" NOT NULL,
    "recipientName" TEXT,
    "recipientPhone" TEXT,
    "status" "KitReminderStatus" NOT NULL DEFAULT 'PENDING',
    "providerMessageId" TEXT,
    "providerStatus" TEXT,
    "errorMessage" TEXT,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KitReminderLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MatchKitPlayer_matchId_teamId_idx" ON "MatchKitPlayer"("matchId", "teamId");

-- CreateIndex
CREATE INDEX "MatchKitPlayer_leagueId_normalizedName_idx" ON "MatchKitPlayer"("leagueId", "normalizedName");

-- CreateIndex
CREATE UNIQUE INDEX "MatchKitPlayer_matchId_teamId_normalizedName_key" ON "MatchKitPlayer"("matchId", "teamId", "normalizedName");

-- CreateIndex
CREATE INDEX "KitRotationMember_leagueId_rotationKey_idx" ON "KitRotationMember"("leagueId", "rotationKey");

-- CreateIndex
CREATE INDEX "KitRotationMember_rotationKey_completedCount_lastCompletedA_idx" ON "KitRotationMember"("rotationKey", "completedCount", "lastCompletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "KitRotationMember_rotationKey_normalizedName_key" ON "KitRotationMember"("rotationKey", "normalizedName");

-- CreateIndex
CREATE INDEX "KitAssignment_leagueId_teamId_status_idx" ON "KitAssignment"("leagueId", "teamId", "status");

-- CreateIndex
CREATE INDEX "KitAssignment_rotationMemberId_status_idx" ON "KitAssignment"("rotationMemberId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "KitAssignment_matchId_teamId_key" ON "KitAssignment"("matchId", "teamId");

-- CreateIndex
CREATE INDEX "KitReminderLog_status_scheduledFor_idx" ON "KitReminderLog"("status", "scheduledFor");

-- CreateIndex
CREATE UNIQUE INDEX "KitReminderLog_assignmentId_recipientType_key" ON "KitReminderLog"("assignmentId", "recipientType");

-- AddForeignKey
ALTER TABLE "MatchKitPlayer" ADD CONSTRAINT "MatchKitPlayer_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchKitPlayer" ADD CONSTRAINT "MatchKitPlayer_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchKitPlayer" ADD CONSTRAINT "MatchKitPlayer_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchKitPlayer" ADD CONSTRAINT "MatchKitPlayer_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KitRotationMember" ADD CONSTRAINT "KitRotationMember_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KitRotationMember" ADD CONSTRAINT "KitRotationMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KitRotationMember" ADD CONSTRAINT "KitRotationMember_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KitAssignment" ADD CONSTRAINT "KitAssignment_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KitAssignment" ADD CONSTRAINT "KitAssignment_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KitAssignment" ADD CONSTRAINT "KitAssignment_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KitAssignment" ADD CONSTRAINT "KitAssignment_rotationMemberId_fkey" FOREIGN KEY ("rotationMemberId") REFERENCES "KitRotationMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KitAssignment" ADD CONSTRAINT "KitAssignment_matchKitPlayerId_fkey" FOREIGN KEY ("matchKitPlayerId") REFERENCES "MatchKitPlayer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KitAssignment" ADD CONSTRAINT "KitAssignment_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KitReminderLog" ADD CONSTRAINT "KitReminderLog_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "KitAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
