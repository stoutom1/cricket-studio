-- Knowledge Center searchable content and typo-tolerant ranking.

CREATE EXTENSION IF NOT EXISTS "pg_trgm";

ALTER TABLE "LeagueResource"
  ADD COLUMN IF NOT EXISTS "extractedText" TEXT,
  ADD COLUMN IF NOT EXISTS "searchText" TEXT,
  ADD COLUMN IF NOT EXISTS "searchStatus" TEXT NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS "searchError" TEXT,
  ADD COLUMN IF NOT EXISTS "searchIndexedAt" TIMESTAMP(3);

ALTER TABLE "LeagueResource"
  ADD COLUMN IF NOT EXISTS "searchVector" tsvector
  GENERATED ALWAYS AS (
    to_tsvector(
      'english',
      COALESCE("searchText", '')
    )
  ) STORED;

CREATE INDEX IF NOT EXISTS
  "LeagueResource_searchVector_idx"
ON "LeagueResource"
USING GIN ("searchVector");

CREATE INDEX IF NOT EXISTS
  "LeagueResource_searchText_trgm_idx"
ON "LeagueResource"
USING GIN (
  "searchText" gin_trgm_ops
);

CREATE INDEX IF NOT EXISTS
  "LeagueResource_leagueId_searchStatus_idx"
ON "LeagueResource"(
  "leagueId",
  "searchStatus"
);
