-- CreateTable
CREATE TABLE "LeagueResource" (
    "id" SERIAL NOT NULL,
    "leagueId" INTEGER NOT NULL,
    "createdById" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'OTHER',
    "resourceType" TEXT NOT NULL DEFAULT 'LINK',
    "visibility" TEXT NOT NULL DEFAULT 'LEAGUE',
    "externalUrl" TEXT,
    "blobUrl" TEXT,
    "blobPathname" TEXT,
    "originalFileName" TEXT,
    "contentType" TEXT,
    "fileSize" INTEGER,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeagueResource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LeagueResource_leagueId_category_idx"
ON "LeagueResource"("leagueId", "category");

-- CreateIndex
CREATE INDEX "LeagueResource_leagueId_isPinned_sortOrder_idx"
ON "LeagueResource"("leagueId", "isPinned", "sortOrder");

-- CreateIndex
CREATE INDEX "LeagueResource_createdById_idx"
ON "LeagueResource"("createdById");

-- AddForeignKey
ALTER TABLE "LeagueResource"
ADD CONSTRAINT "LeagueResource_leagueId_fkey"
FOREIGN KEY ("leagueId") REFERENCES "League"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeagueResource"
ADD CONSTRAINT "LeagueResource_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
