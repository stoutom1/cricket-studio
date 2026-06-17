/*
  Warnings:

  - A unique constraint covering the columns `[slug]` on the table `League` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "League" ADD COLUMN     "slug" TEXT,
ADD COLUMN     "visibility" TEXT NOT NULL DEFAULT 'PRIVATE';

-- CreateIndex
CREATE UNIQUE INDEX "League_slug_key" ON "League"("slug");
