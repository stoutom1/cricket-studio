-- AddForeignKey
ALTER TABLE "WicketKeeperChange" ADD CONSTRAINT "WicketKeeperChange_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;
