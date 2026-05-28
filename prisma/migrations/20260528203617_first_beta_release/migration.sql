-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "statusText" TEXT,
ALTER COLUMN "status" SET DEFAULT 'LIVE';
