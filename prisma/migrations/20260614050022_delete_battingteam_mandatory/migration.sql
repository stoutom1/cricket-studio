-- DropForeignKey
ALTER TABLE "Match" DROP CONSTRAINT "Match_battingFirstTeamId_fkey";

-- AlterTable
ALTER TABLE "Match" ALTER COLUMN "battingFirstTeamId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_battingFirstTeamId_fkey" FOREIGN KEY ("battingFirstTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
