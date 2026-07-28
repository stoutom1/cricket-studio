-- DropForeignKey
ALTER TABLE "KitReminderLog" DROP CONSTRAINT "KitReminderLog_leagueId_fkey";

-- DropForeignKey
ALTER TABLE "KitReminderLog" DROP CONSTRAINT "KitReminderLog_matchId_fkey";

-- DropForeignKey
ALTER TABLE "KitReminderLog" DROP CONSTRAINT "KitReminderLog_teamId_fkey";

-- AddForeignKey
ALTER TABLE "KitReminderLog" ADD CONSTRAINT "KitReminderLog_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KitReminderLog" ADD CONSTRAINT "KitReminderLog_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KitReminderLog" ADD CONSTRAINT "KitReminderLog_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
