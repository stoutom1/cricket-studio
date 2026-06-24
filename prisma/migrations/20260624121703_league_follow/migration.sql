-- CreateTable
CREATE TABLE "LeagueFollower" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "leagueId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeagueFollower_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LeagueFollower_userId_leagueId_key" ON "LeagueFollower"("userId", "leagueId");

-- AddForeignKey
ALTER TABLE "LeagueFollower" ADD CONSTRAINT "LeagueFollower_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeagueFollower" ADD CONSTRAINT "LeagueFollower_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE;
