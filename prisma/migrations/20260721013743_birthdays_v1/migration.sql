/*
  Warnings:

  - A unique constraint covering the columns `[leagueId,playerId]` on the table `LeagueBirthday` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `playerId` to the `LeagueBirthday` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "LeagueBirthday" ADD COLUMN     "playerId" INTEGER NOT NULL;

-- CreateIndex
CREATE INDEX "LeagueBirthday_playerId_idx" ON "LeagueBirthday"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "LeagueBirthday_leagueId_playerId_key" ON "LeagueBirthday"("leagueId", "playerId");

-- AddForeignKey
ALTER TABLE "LeagueBirthday" ADD CONSTRAINT "LeagueBirthday_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
