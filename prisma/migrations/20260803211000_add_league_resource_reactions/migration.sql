-- CreateTable
CREATE TABLE "LeagueResourceReaction" (
    "id" SERIAL NOT NULL,
    "resourceId" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "reaction" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeagueResourceReaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LeagueResourceReaction_resourceId_userId_key"
ON "LeagueResourceReaction"("resourceId", "userId");

-- CreateIndex
CREATE INDEX "LeagueResourceReaction_resourceId_reaction_idx"
ON "LeagueResourceReaction"("resourceId", "reaction");

-- CreateIndex
CREATE INDEX "LeagueResourceReaction_userId_idx"
ON "LeagueResourceReaction"("userId");

-- AddForeignKey
ALTER TABLE "LeagueResourceReaction"
ADD CONSTRAINT "LeagueResourceReaction_resourceId_fkey"
FOREIGN KEY ("resourceId") REFERENCES "LeagueResource"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeagueResourceReaction"
ADD CONSTRAINT "LeagueResourceReaction_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
