-- CreateTable
CREATE TABLE "MatchState" (
    "matchId" INTEGER NOT NULL,
    "inningsNo" INTEGER NOT NULL,
    "strikerId" INTEGER,
    "nonStrikerId" INTEGER,
    "bowlerId" INTEGER,

    CONSTRAINT "MatchState_pkey" PRIMARY KEY ("matchId")
);

-- AddForeignKey
ALTER TABLE "MatchState" ADD CONSTRAINT "MatchState_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
