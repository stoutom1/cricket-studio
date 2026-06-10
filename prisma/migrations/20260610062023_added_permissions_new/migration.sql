-- AlterTable
ALTER TABLE "LeagueMember" ADD COLUMN     "canAbandonMatch" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canCreateLeague" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canEndMatch" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canLockMatch" BOOLEAN NOT NULL DEFAULT false;
