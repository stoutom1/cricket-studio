-- CreateTable
CREATE TABLE "WicketKeeperChange" (
    "id" SERIAL NOT NULL,
    "matchId" INTEGER NOT NULL,
    "inningsNo" INTEGER NOT NULL,
    "afterSequence" INTEGER NOT NULL DEFAULT 0,
    "teamId" INTEGER NOT NULL,
    "oldKeeperId" INTEGER,
    "newKeeperId" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WicketKeeperChange_pkey" PRIMARY KEY ("id")
);
