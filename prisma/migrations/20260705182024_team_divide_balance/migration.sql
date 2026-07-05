-- CreateTable
CREATE TABLE "TeamBalanceVote" (
    "id" SERIAL NOT NULL,
    "matchId" INTEGER NOT NULL,
    "voterName" TEXT,
    "vote" TEXT NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamBalanceVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamBalanceSuggestion" (
    "id" SERIAL NOT NULL,
    "matchId" INTEGER NOT NULL,
    "fromTeamAPlayerId" INTEGER NOT NULL,
    "fromTeamBPlayerId" INTEGER NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamBalanceSuggestion_pkey" PRIMARY KEY ("id")
);
