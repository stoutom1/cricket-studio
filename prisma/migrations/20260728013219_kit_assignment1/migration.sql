/*
  Warnings:

  - Added the required column `rotationKey` to the `KitAssignment` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "KitPickupStatus" AS ENUM ('PENDING', 'TOOK_KIT', 'DID_NOT_TAKE_KIT');

-- AlterTable
ALTER TABLE "KitAssignment" ADD COLUMN     "actualDisplayName" TEXT,
ADD COLUMN     "actualMatchKitPlayerId" INTEGER,
ADD COLUMN     "actualRotationMemberId" INTEGER,
ADD COLUMN     "pickupRecordedAt" TIMESTAMP(3),
ADD COLUMN     "pickupRecordedById" TEXT,
ADD COLUMN     "pickupStatus" "KitPickupStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "rotationKey" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "KitAssignment_actualRotationMemberId_pickupStatus_idx" ON "KitAssignment"("actualRotationMemberId", "pickupStatus");

-- CreateIndex
CREATE INDEX "KitAssignment_matchKitPlayerId_idx" ON "KitAssignment"("matchKitPlayerId");

-- CreateIndex
CREATE INDEX "KitAssignment_actualMatchKitPlayerId_idx" ON "KitAssignment"("actualMatchKitPlayerId");

-- AddForeignKey
ALTER TABLE "KitAssignment" ADD CONSTRAINT "KitAssignment_actualRotationMemberId_fkey" FOREIGN KEY ("actualRotationMemberId") REFERENCES "KitRotationMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KitAssignment" ADD CONSTRAINT "KitAssignment_actualMatchKitPlayerId_fkey" FOREIGN KEY ("actualMatchKitPlayerId") REFERENCES "MatchKitPlayer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KitAssignment" ADD CONSTRAINT "KitAssignment_pickupRecordedById_fkey" FOREIGN KEY ("pickupRecordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
