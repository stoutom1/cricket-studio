-- AlterTable
ALTER TABLE "League" ADD COLUMN     "ownerWhatsAppNumber" TEXT,
ADD COLUMN     "whatsappNotificationsEnabled" BOOLEAN NOT NULL DEFAULT false;
