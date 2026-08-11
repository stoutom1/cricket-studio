-- Add a backup league owner/contact for birthday reminder delivery.
ALTER TABLE "League"
ADD COLUMN "backupOwnerId" TEXT,
ADD COLUMN "backupOwnerWhatsAppNumber" TEXT;

ALTER TABLE "League"
ADD CONSTRAINT "League_backupOwnerId_fkey"
FOREIGN KEY ("backupOwnerId")
REFERENCES "User"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

CREATE INDEX "League_backupOwnerId_idx"
ON "League"("backupOwnerId");
