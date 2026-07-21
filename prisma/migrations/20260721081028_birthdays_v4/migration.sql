-- AlterTable
ALTER TABLE "LeagueBirthday" ADD COLUMN     "whatsappNumber" TEXT,
ADD COLUMN     "whatsappOptIn" BOOLEAN NOT NULL DEFAULT false;
