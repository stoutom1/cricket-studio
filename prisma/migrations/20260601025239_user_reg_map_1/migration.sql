/*
  Warnings:

  - A unique constraint covering the columns `[leagueId,userId]` on the table `LeagueRegistration` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "LeagueRegistration_leagueId_userId_key" ON "LeagueRegistration"("leagueId", "userId");
