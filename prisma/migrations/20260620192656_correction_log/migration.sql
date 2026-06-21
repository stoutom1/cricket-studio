-- CreateTable
CREATE TABLE "CorrectionLog" (
    "id" SERIAL NOT NULL,
    "matchId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "correctionBallId" INTEGER,
    "payload" JSONB,
    "beforeBalls" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revertedAt" TIMESTAMP(3),

    CONSTRAINT "CorrectionLog_pkey" PRIMARY KEY ("id")
);
