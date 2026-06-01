-- AlterTable
ALTER TABLE "LeagueRegistration" ADD COLUMN     "userId" TEXT;

-- AddForeignKey
ALTER TABLE "LeagueRegistration" ADD CONSTRAINT "LeagueRegistration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
