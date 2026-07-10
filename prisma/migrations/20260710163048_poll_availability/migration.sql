-- AlterTable
ALTER TABLE "LeagueMember" ADD COLUMN     "canCreateAvailabilityPoll" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canUseTeamBuilder" BOOLEAN NOT NULL DEFAULT false;
