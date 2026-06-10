/*
  Warnings:

  - A unique constraint covering the columns `[shareCode]` on the table `Match` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "shareCode" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Match_shareCode_key" ON "Match"("shareCode");
