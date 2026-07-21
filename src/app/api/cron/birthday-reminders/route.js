import { NextResponse } from "next/server";
import { DateTime } from "luxon";

import prisma from "@/lib/prisma";
import {
  birthdayWhereForDate,
  getLocalBirthdayCheck,
} from "@/lib/birthdayDates";
import { sendBirthdayPush } from "@/lib/sendBirthdayPush";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorizeCron(request) {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    return false;
  }

  const authorization = request.headers.get("authorization");

  return authorization === `Bearer ${secret}`;
}

async function createAndSendReminder({
  birthday,
  preference,
  reminderType,
  birthdayYear,
}) {
  const uniqueWhere = {
    birthdayId_recipientUserId_birthdayYear_reminderType: {
      birthdayId: birthday.id,
      recipientUserId: preference.userId,
      birthdayYear,
      reminderType,
    },
  };

  const existing = await prisma.birthdayReminderLog.findUnique({
    where: uniqueWhere,
    select: {
      id: true,
      status: true,
    },
  });

  if (existing?.status === "SENT" || existing?.status === "SHARED") {
    return {
      skipped: true,
    };
  }

  const isToday = reminderType === "BIRTHDAY_TODAY";

  const title = isToday
    ? "🎂 Birthday Today"
    : "🎂 Birthday Tomorrow";

  const body = isToday
    ? `Today is ${birthday.name}'s birthday. Tap to prepare and share the league wish.`
    : `${birthday.name}'s birthday is tomorrow. Tap to prepare the birthday wish.`;

  const url =
    `/leagues/${birthday.leagueId}/birthdays/today` +
    `?birthdayId=${birthday.id}`;

  const log = await prisma.birthdayReminderLog.upsert({
    where: uniqueWhere,
    create: {
      birthdayId: birthday.id,
      leagueId: birthday.leagueId,
      recipientUserId: preference.userId,
      birthdayYear,
      reminderType,
      status: "PENDING",
      notificationTitle: title,
      notificationBody: body,
    },
    update: {
      status: "PENDING",
      errorMessage: null,
      notificationTitle: title,
      notificationBody: body,
    },
  });

  try {
    const result = await sendBirthdayPush({
      recipientUserId: preference.userId,
      title,
      body,
      url,
    });

    if (result.noDevices) {
      await prisma.birthdayReminderLog.update({
        where: {
          id: log.id,
        },
        data: {
          status: "FAILED",
          errorMessage: "No enabled push device is registered.",
        },
      });

      return {
        sent: false,
        reason: "NO_DEVICE",
      };
    }

    if (result.sentCount === 0) {
      throw new Error("All push-delivery attempts failed.");
    }

    await prisma.birthdayReminderLog.update({
      where: {
        id: log.id,
      },
      data: {
        status: "SENT",
        sentAt: new Date(),
        errorMessage:
          result.failedCount > 0
            ? `${result.failedCount} device delivery attempts failed.`
            : null,
      },
    });

    return {
      sent: true,
      sentCount: result.sentCount,
    };
  } catch (error) {
    await prisma.birthdayReminderLog.update({
      where: {
        id: log.id,
      },
      data: {
        status: "FAILED",
        errorMessage: String(
          error instanceof Error ? error.message : error
        ).slice(0, 1000),
      },
    });

    return {
      sent: false,
      reason: "SEND_FAILED",
    };
  }
}

export async function GET(request) {
  if (!authorizeCron(request)) {
    return NextResponse.json(
      { error: "Unauthorized cron request." },
      { status: 401 }
    );
  }

  try {
    const now = DateTime.utc();

    const preferences =
      await prisma.birthdayNotificationPreference.findMany({
        where: {
          enabled: true,
          OR: [
            { notifyDayBefore: true },
            { notifyOnBirthday: true },
          ],
        },
        select: {
          userId: true,
          leagueId: true,
          notifyDayBefore: true,
          notifyOnBirthday: true,
          reminderHour: true,
          timeZone: true,
        },
      });

    let checkedPreferences = 0;
    let sentReminders = 0;
    let skippedPreferences = 0;
    let failedReminders = 0;

    for (const preference of preferences) {
      let check;

      try {
        check = getLocalBirthdayCheck({
          now,
          timeZone: preference.timeZone,
          reminderHour: preference.reminderHour,
        });
      } catch (error) {
        console.error(
          `Invalid birthday preference for ${preference.userId}:`,
          error
        );

        failedReminders += 1;
        continue;
      }

      if (!check.shouldRun) {
        skippedPreferences += 1;
        continue;
      }

      checkedPreferences += 1;

      if (preference.notifyOnBirthday) {
        const todayBirthdays =
          await prisma.leagueBirthday.findMany({
            where: {
              leagueId: preference.leagueId,
              isActive: true,
              ...birthdayWhereForDate(
                check.today.month,
                check.today.day,
                check.today.year
              ),
            },
            select: {
              id: true,
              leagueId: true,
              name: true,
              birthMonth: true,
              birthDay: true,
            },
          });

        for (const birthday of todayBirthdays) {
          const result = await createAndSendReminder({
            birthday,
            preference,
            reminderType: "BIRTHDAY_TODAY",
            birthdayYear: check.today.year,
          });

          if (result.sent) {
            sentReminders += 1;
          } else if (!result.skipped) {
            failedReminders += 1;
          }
        }
      }

      if (preference.notifyDayBefore) {
        const tomorrowBirthdays =
          await prisma.leagueBirthday.findMany({
            where: {
              leagueId: preference.leagueId,
              isActive: true,
              ...birthdayWhereForDate(
                check.tomorrow.month,
                check.tomorrow.day,
                check.tomorrow.year
              ),
            },
            select: {
              id: true,
              leagueId: true,
              name: true,
              birthMonth: true,
              birthDay: true,
            },
          });

        for (const birthday of tomorrowBirthdays) {
          const result = await createAndSendReminder({
            birthday,
            preference,
            reminderType: "DAY_BEFORE",
            birthdayYear: check.tomorrow.year,
          });

          if (result.sent) {
            sentReminders += 1;
          } else if (!result.skipped) {
            failedReminders += 1;
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      checkedAtUtc: now.toISO(),
      preferenceCount: preferences.length,
      checkedPreferences,
      skippedPreferences,
      sentReminders,
      failedReminders,
    });
  } catch (error) {
    console.error("Birthday reminder cron failed:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Birthday reminder processing failed.",
      },
      { status: 500 }
    );
  }
}