-- AlterTable
ALTER TABLE "CorrectionLog" ADD COLUMN     "afterJson" JSONB,
ADD COLUMN     "beforeJson" JSONB,
ADD COLUMN     "correctedByEmail" TEXT,
ADD COLUMN     "correctedById" INTEGER,
ADD COLUMN     "correctedByName" TEXT,
ADD COLUMN     "correctionLabel" TEXT,
ADD COLUMN     "correctionType" TEXT DEFAULT 'RETIRED_HURT',
ADD COLUMN     "reason" TEXT;
