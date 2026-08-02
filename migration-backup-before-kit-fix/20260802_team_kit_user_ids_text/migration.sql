-- Align team-kit audit/access user IDs with the existing User.id TEXT column.

ALTER TABLE "TeamKitState"
  ALTER COLUMN "recordedByUserId" TYPE TEXT
  USING "recordedByUserId"::TEXT;

ALTER TABLE "TeamKitCustodyTask"
  ALTER COLUMN "resolvedByUserId" TYPE TEXT
  USING "resolvedByUserId"::TEXT;

ALTER TABLE "TeamKitCustodyEvent"
  ALTER COLUMN "recordedByUserId" TYPE TEXT
  USING "recordedByUserId"::TEXT;

ALTER TABLE "TeamKitUserAccess"
  ALTER COLUMN "userId" TYPE TEXT
  USING "userId"::TEXT;
