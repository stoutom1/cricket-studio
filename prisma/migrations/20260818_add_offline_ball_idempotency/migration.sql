-- Cric4All Offline Scoring Phase 1
-- Adds idempotency/audit metadata to Ball. Existing rows remain valid.

ALTER TABLE "Ball"
ADD COLUMN "clientEventId" TEXT,
ADD COLUMN "clientDeviceId" TEXT,
ADD COLUMN "clientCreatedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "Ball_clientEventId_key"
ON "Ball"("clientEventId");

CREATE INDEX "Ball_clientDeviceId_idx"
ON "Ball"("clientDeviceId");
