-- CreateEnum
CREATE TYPE "BirthdayReminderType" AS ENUM ('DAY_BEFORE', 'BIRTHDAY_TODAY');

-- CreateEnum
CREATE TYPE "BirthdayReminderStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SHARED');

-- CreateTable
CREATE TABLE "LeagueBirthday" (
    "id" SERIAL NOT NULL,
    "leagueId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "birthMonth" INTEGER NOT NULL,
    "birthDay" INTEGER NOT NULL,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeagueBirthday_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BirthdayNotificationPreference" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "leagueId" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "notifyDayBefore" BOOLEAN NOT NULL DEFAULT true,
    "notifyOnBirthday" BOOLEAN NOT NULL DEFAULT true,
    "reminderHour" INTEGER NOT NULL DEFAULT 8,
    "timeZone" TEXT NOT NULL DEFAULT 'America/Los_Angeles',
    "emailFallbackEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BirthdayNotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushDevice" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "deviceName" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PushDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BirthdayReminderLog" (
    "id" SERIAL NOT NULL,
    "birthdayId" INTEGER NOT NULL,
    "leagueId" INTEGER NOT NULL,
    "recipientUserId" TEXT NOT NULL,
    "birthdayYear" INTEGER NOT NULL,
    "reminderType" "BirthdayReminderType" NOT NULL,
    "status" "BirthdayReminderStatus" NOT NULL DEFAULT 'PENDING',
    "notificationTitle" TEXT,
    "notificationBody" TEXT,
    "errorMessage" TEXT,
    "sentAt" TIMESTAMP(3),
    "sharedAt" TIMESTAMP(3),
    "sharedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BirthdayReminderLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LeagueBirthday_leagueId_idx" ON "LeagueBirthday"("leagueId");

-- CreateIndex
CREATE INDEX "LeagueBirthday_leagueId_birthMonth_birthDay_idx" ON "LeagueBirthday"("leagueId", "birthMonth", "birthDay");

-- CreateIndex
CREATE INDEX "LeagueBirthday_leagueId_isActive_idx" ON "LeagueBirthday"("leagueId", "isActive");

-- CreateIndex
CREATE INDEX "BirthdayNotificationPreference_leagueId_enabled_idx" ON "BirthdayNotificationPreference"("leagueId", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "BirthdayNotificationPreference_userId_leagueId_key" ON "BirthdayNotificationPreference"("userId", "leagueId");

-- CreateIndex
CREATE UNIQUE INDEX "PushDevice_token_key" ON "PushDevice"("token");

-- CreateIndex
CREATE INDEX "PushDevice_userId_enabled_idx" ON "PushDevice"("userId", "enabled");

-- CreateIndex
CREATE INDEX "BirthdayReminderLog_leagueId_birthdayYear_idx" ON "BirthdayReminderLog"("leagueId", "birthdayYear");

-- CreateIndex
CREATE INDEX "BirthdayReminderLog_recipientUserId_status_idx" ON "BirthdayReminderLog"("recipientUserId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "BirthdayReminderLog_birthdayId_recipientUserId_birthdayYear_key" ON "BirthdayReminderLog"("birthdayId", "recipientUserId", "birthdayYear", "reminderType");

-- AddForeignKey
ALTER TABLE "LeagueBirthday" ADD CONSTRAINT "LeagueBirthday_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeagueBirthday" ADD CONSTRAINT "LeagueBirthday_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeagueBirthday" ADD CONSTRAINT "LeagueBirthday_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BirthdayNotificationPreference" ADD CONSTRAINT "BirthdayNotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BirthdayNotificationPreference" ADD CONSTRAINT "BirthdayNotificationPreference_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushDevice" ADD CONSTRAINT "PushDevice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BirthdayReminderLog" ADD CONSTRAINT "BirthdayReminderLog_birthdayId_fkey" FOREIGN KEY ("birthdayId") REFERENCES "LeagueBirthday"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BirthdayReminderLog" ADD CONSTRAINT "BirthdayReminderLog_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BirthdayReminderLog" ADD CONSTRAINT "BirthdayReminderLog_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BirthdayReminderLog" ADD CONSTRAINT "BirthdayReminderLog_sharedById_fkey" FOREIGN KEY ("sharedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
