-- CreateTable
CREATE TABLE "TeamAvailabilityPoll" (
    "id" SERIAL NOT NULL,
    "token" TEXT NOT NULL,
    "leagueId" INTEGER,
    "title" TEXT NOT NULL,
    "matchText" TEXT,
    "startTime" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamAvailabilityPoll_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamAvailabilityResponse" (
    "id" SERIAL NOT NULL,
    "pollId" INTEGER NOT NULL,
    "playerKey" TEXT NOT NULL,
    "playerName" TEXT NOT NULL,
    "response" TEXT NOT NULL,
    "displayName" TEXT,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamAvailabilityResponse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TeamAvailabilityPoll_token_key" ON "TeamAvailabilityPoll"("token");

-- CreateIndex
CREATE UNIQUE INDEX "TeamAvailabilityResponse_pollId_playerKey_key" ON "TeamAvailabilityResponse"("pollId", "playerKey");

-- AddForeignKey
ALTER TABLE "TeamAvailabilityResponse" ADD CONSTRAINT "TeamAvailabilityResponse_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "TeamAvailabilityPoll"("id") ON DELETE CASCADE ON UPDATE CASCADE;
