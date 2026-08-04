CREATE TABLE "LeagueResourceFavorite" (
  "id" SERIAL NOT NULL,
  "resourceId" INTEGER NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "LeagueResourceFavorite_pkey"
    PRIMARY KEY ("id")
);

CREATE TABLE "LeagueResourceCollection" (
  "id" SERIAL NOT NULL,
  "leagueId" INTEGER NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "LeagueResourceCollection_pkey"
    PRIMARY KEY ("id")
);

CREATE TABLE "LeagueResourceCollectionItem" (
  "id" SERIAL NOT NULL,
  "collectionId" INTEGER NOT NULL,
  "resourceId" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "LeagueResourceCollectionItem_pkey"
    PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX
  "LeagueResourceFavorite_resourceId_userId_key"
ON "LeagueResourceFavorite"(
  "resourceId",
  "userId"
);

CREATE INDEX
  "LeagueResourceFavorite_userId_createdAt_idx"
ON "LeagueResourceFavorite"(
  "userId",
  "createdAt"
);

CREATE INDEX
  "LeagueResourceFavorite_resourceId_idx"
ON "LeagueResourceFavorite"(
  "resourceId"
);

CREATE UNIQUE INDEX
  "LeagueResourceCollection_leagueId_userId_name_key"
ON "LeagueResourceCollection"(
  "leagueId",
  "userId",
  "name"
);

CREATE INDEX
  "LeagueResourceCollection_leagueId_userId_updatedAt_idx"
ON "LeagueResourceCollection"(
  "leagueId",
  "userId",
  "updatedAt"
);

CREATE UNIQUE INDEX
  "LeagueResourceCollectionItem_collectionId_resourceId_key"
ON "LeagueResourceCollectionItem"(
  "collectionId",
  "resourceId"
);

CREATE INDEX
  "LeagueResourceCollectionItem_resourceId_idx"
ON "LeagueResourceCollectionItem"(
  "resourceId"
);

ALTER TABLE "LeagueResourceFavorite"
ADD CONSTRAINT
  "LeagueResourceFavorite_resourceId_fkey"
FOREIGN KEY ("resourceId")
REFERENCES "LeagueResource"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "LeagueResourceFavorite"
ADD CONSTRAINT
  "LeagueResourceFavorite_userId_fkey"
FOREIGN KEY ("userId")
REFERENCES "User"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "LeagueResourceCollection"
ADD CONSTRAINT
  "LeagueResourceCollection_leagueId_fkey"
FOREIGN KEY ("leagueId")
REFERENCES "League"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "LeagueResourceCollection"
ADD CONSTRAINT
  "LeagueResourceCollection_userId_fkey"
FOREIGN KEY ("userId")
REFERENCES "User"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "LeagueResourceCollectionItem"
ADD CONSTRAINT
  "LeagueResourceCollectionItem_collectionId_fkey"
FOREIGN KEY ("collectionId")
REFERENCES "LeagueResourceCollection"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "LeagueResourceCollectionItem"
ADD CONSTRAINT
  "LeagueResourceCollectionItem_resourceId_fkey"
FOREIGN KEY ("resourceId")
REFERENCES "LeagueResource"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;
