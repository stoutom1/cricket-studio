/*
  Warnings:

  - A unique constraint covering the columns `[pollId,optionId,playerKey]` on the table `TeamAvailabilityResponse` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `optionId` to the `TeamAvailabilityResponse` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "TeamAvailabilityResponse_pollId_playerKey_key";

-- AlterTable
ALTER TABLE "TeamAvailabilityResponse" ADD COLUMN     "optionId" INTEGER NOT NULL;

-- CreateTable
CREATE TABLE "TeamAvailabilityOption" (
    "id" SERIAL NOT NULL,
    "pollId" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "startTime" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TeamAvailabilityOption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TeamAvailabilityResponse_pollId_optionId_playerKey_key" ON "TeamAvailabilityResponse"("pollId", "optionId", "playerKey");

-- AddForeignKey
ALTER TABLE "TeamAvailabilityOption" ADD CONSTRAINT "TeamAvailabilityOption_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "TeamAvailabilityPoll"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamAvailabilityResponse" ADD CONSTRAINT "TeamAvailabilityResponse_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "TeamAvailabilityOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;
