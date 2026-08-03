-- Store only one live kit-carrier suggestion per league/team scope.
-- Future re-suggestions overwrite TeamKitState instead of inserting
-- transient SUGGESTED rows into TeamKitCustodyEvent.

ALTER TABLE "TeamKitState"
  ADD COLUMN IF NOT EXISTS "suggestedHolderPlayerId" INTEGER,
  ADD COLUMN IF NOT EXISTS "suggestedHolderName" TEXT,
  ADD COLUMN IF NOT EXISTS "suggestedForMatchId" INTEGER,
  ADD COLUMN IF NOT EXISTS "suggestedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "suggestedByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "suggestionNote" TEXT;

CREATE INDEX IF NOT EXISTS
  "TeamKitState_suggestedForMatchId_idx"
ON "TeamKitState" ("suggestedForMatchId");

-- Preserve the latest still-active legacy SUGGESTED event as the live state
-- during rollout. Existing legacy event rows are intentionally not deleted.
WITH latest_suggestion AS (
  SELECT DISTINCT ON (
    event."leagueId",
    event."scopeKey"
  )
    event."leagueId",
    event."scopeKey",
    event."teamId",
    event."matchId",
    event."holderPlayerId",
    event."holderName",
    event."createdAt",
    event."recordedByUserId",
    event."note"
  FROM "TeamKitCustodyEvent" event
  WHERE event."action" = 'SUGGESTED'
    AND NOT EXISTS (
      SELECT 1
      FROM "TeamKitCustodyEvent" actual
      WHERE actual."leagueId" =
            event."leagueId"
        AND actual."scopeKey" =
            event."scopeKey"
        AND actual."action" IN (
          'RECORDED',
          'RECORDED_AS_SUGGESTED'
        )
        AND (
          actual."createdAt" >
            event."createdAt"
          OR (
            actual."createdAt" =
              event."createdAt"
            AND actual."id" >
              event."id"
          )
        )
    )
  ORDER BY
    event."leagueId",
    event."scopeKey",
    event."createdAt" DESC,
    event."id" DESC
)
UPDATE "TeamKitState" state
SET
  "suggestedHolderPlayerId" =
    latest."holderPlayerId",
  "suggestedHolderName" =
    latest."holderName",
  "suggestedForMatchId" =
    latest."matchId",
  "suggestedAt" =
    latest."createdAt",
  "suggestedByUserId" =
    latest."recordedByUserId",
  "suggestionNote" =
    latest."note"
FROM latest_suggestion latest
WHERE state."leagueId" =
      latest."leagueId"
  AND state."scopeKey" =
      latest."scopeKey"
  AND state."suggestedHolderName"
      IS NULL;
