import { NextResponse } from "next/server";
import { DateTime } from "luxon";

import prisma from "@/lib/prisma";
import {
  birthdayWhereForDate,
  getLocalBirthdayCheck,
} from "@/lib/birthdayDates";
import { sendBirthdayPush } from "@/lib/sendBirthdayPush";
import {
  sendBirthdayOwnerSms,
} from "@/lib/sendBirthdayOwnerSms";

import {
  sendTwilioWhatsAppBirthdayMessage,
} from "@/lib/sendTwilioWhatsAppBirthdayMessage";

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

let ownerSmsSent = 0;
let ownerSmsSkipped = 0;
let ownerSmsFailed = 0;

let playerWhatsAppQueued = 0;
let playerWhatsAppSkipped = 0;
let playerWhatsAppFailed = 0;
let duplicatePlayerWhatsApps = 0;

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
  playerId: true,

  name: true,
  birthMonth: true,
  birthDay: true,

  whatsappNumber: true,
  whatsappOptIn: true,

  league: {
    select: {
      id: true,
      name: true,
      ownerId: true,
      ownerWhatsAppNumber: true,
      whatsappNotificationsEnabled: true,
    },
  },

  player: {
    select: {
      id: true,
      name: true,
      whatsappNumber: true,
      whatsappOptIn: true,
    },
  },
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
        /*
 * Send a personal birthday greeting to every opted-in
 * birthday player.
 *
 * A queued WhatsApp message is not yet considered delivered.
 * The Twilio status callback handles final delivery and
 * sends SMS fallback when Meta returns error 63049.
 */
for (const birthday of todayBirthdays) {
  const recipientPhone =
    String(
      birthday.whatsappNumber ||
      birthday.player?.whatsappNumber ||
      ""
    ).trim();

  const whatsappOptIn =
    birthday.whatsappOptIn === true ||
    birthday.player?.whatsappOptIn === true;

  const leagueWhatsAppEnabled =
    birthday.league
      ?.whatsappNotificationsEnabled === true;

  if (!leagueWhatsAppEnabled) {
    playerWhatsAppSkipped += 1;

    console.log(
      "[BIRTHDAY_PLAYER_WHATSAPP_SKIPPED]",
      {
        birthdayId: birthday.id,
        reason:
          "WhatsApp notifications are disabled for this league.",
      }
    );

    continue;
  }

  if (!whatsappOptIn) {
    playerWhatsAppSkipped += 1;

    console.log(
      "[BIRTHDAY_PLAYER_WHATSAPP_SKIPPED]",
      {
        birthdayId: birthday.id,
        reason:
          "The player has not opted in.",
      }
    );

    continue;
  }

  if (!recipientPhone) {
    playerWhatsAppSkipped += 1;

    console.log(
      "[BIRTHDAY_PLAYER_WHATSAPP_SKIPPED]",
      {
        birthdayId: birthday.id,
        reason:
          "The player WhatsApp number is missing.",
      }
    );

    continue;
  }

  const ownerUserId =
    birthday.league?.ownerId ||
    preference.userId;

  const playerWhatsAppUniqueWhere = {
    birthdayId_recipientUserId_birthdayYear_reminderType: {
      birthdayId: birthday.id,
      recipientUserId: ownerUserId,
      birthdayYear: check.today.year,
      reminderType: "PLAYER_WHATSAPP",
    },
  };

const existingPlayerWhatsAppLog =
  await prisma.birthdayReminderLog.findUnique({
    where: playerWhatsAppUniqueWhere,
    select: {
      id: true,
      status: true,
      providerStatus: true,
      providerMessageId: true,
    },
  });

const completedStatuses = [
  "PENDING",
  "SENT",
  "SHARED",
  "DELIVERED",
  "READ",
];

if (
  existingPlayerWhatsAppLog &&
  completedStatuses.includes(existingPlayerWhatsAppLog.status)
) {
  playerWhatsAppSkipped++;

  console.log("[BIRTHDAY_PLAYER_WHATSAPP_SKIP]", {
    reminderLogId: existingPlayerWhatsAppLog.id,
    status: existingPlayerWhatsAppLog.status,
    providerStatus: existingPlayerWhatsAppLog.providerStatus,
    messageSid: existingPlayerWhatsAppLog.providerMessageId,
  });

  continue;
}

  const playerWhatsAppLog =
    await prisma.birthdayReminderLog.upsert({
      where: playerWhatsAppUniqueWhere,

      create: {
        birthdayId: birthday.id,
        leagueId: birthday.leagueId,
        recipientUserId: ownerUserId,
        birthdayYear: check.today.year,
        reminderType: "PLAYER_WHATSAPP",
        status: "PENDING",
        recipientPhone,
        notificationTitle:
          `Birthday greeting for ${
            birthday.player?.name ||
            birthday.name
          }`,
        notificationBody:
          `Birthday greeting from ${
            birthday.league?.name ||
            "Cric4All"
          }.`,
      },

update: {
    status: "PENDING",
    recipientPhone,
    errorMessage: null,
}
    });
const latestReminder =
  await prisma.birthdayReminderLog.findUnique({
    where: {
      id: playerWhatsAppLog.id,
    },
    select: {
      status: true,
      providerMessageId: true,
    },
  });

if (
  latestReminder?.providerMessageId ||
  latestReminder?.status === "PENDING"
) {
  playerWhatsAppSkipped++;

  console.log(
    "[BIRTHDAY_PLAYER_WHATSAPP_ALREADY_QUEUED]",
    {
      reminderLogId: playerWhatsAppLog.id,
    }
  );

  continue;
}

const startedAt = Date.now();

  try {
    const whatsappResult =
      await sendTwilioWhatsAppBirthdayMessage({
        recipientPhone,

        playerName:
          birthday.player?.name ||
          birthday.name,

        leagueName:
          birthday.league?.name ||
          "Cric4All League",

        birthdayId:
          birthday.id,

        leagueId:
          birthday.leagueId,
      });

    /*
     * Mark as SENT here only to prevent the cron from
     * submitting the same template repeatedly.
     *
     * providerStatus will normally be "queued".
     * The callback should later update final delivery status.
     */
    const elapsedMs = Date.now() - startedAt;
    const attemptTime = new Date();

await prisma.birthdayReminderLog.update({
  where: {
    id: playerWhatsAppLog.id,
  },

  data: {
    status: "PENDING",

    providerMessageId: whatsappResult.messageSid,

    providerStatus:
      (whatsappResult.status || "QUEUED").toUpperCase(),

    recipientPhone,

    lastAttemptAt: attemptTime,

    errorMessage: null,
  },
});

    playerWhatsAppQueued += 1;

console.log("[BIRTHDAY_PLAYER_WHATSAPP_QUEUED]", {
  reminderLogId: playerWhatsAppLog.id,
  birthdayId: birthday.id,
  leagueId: birthday.leagueId,

  playerName:
    birthday.player?.name ||
    birthday.name,

  recipientPhone,

  messageSid:
    whatsappResult.messageSid,

  providerStatus:
    (whatsappResult.status || "QUEUED").toUpperCase(),

  attemptedAt: attemptTime.toISOString(),
  elapsedMs,
});
  } catch (whatsappError) {
    playerWhatsAppFailed += 1;

    const errorMessage =
      String(
        whatsappError instanceof Error
          ? whatsappError.message
          : whatsappError
      ).slice(0, 1000);

    await prisma.birthdayReminderLog.update({
      where: {
        id: playerWhatsAppLog.id,
      },

      data: {
        status: "FAILED",
        providerStatus: "failed",
        errorMessage,
      },
    });

 console.error(
  "[BIRTHDAY_PLAYER_WHATSAPP_FAILED]",
  {
    reminderLogId: playerWhatsAppLog.id,
    birthdayId: birthday.id,
    leagueId: birthday.leagueId,

    playerName:
      birthday.player?.name ||
      birthday.name,

    recipientPhone,

    attemptedAt: attemptTime.toISOString(),

    error: errorMessage,
  }
);
  }
}
      }
/*
 * Send one SMS summary to the owner for all birthdays
 * found in this league today.
 */
if (todayBirthdays.length > 0) {
  const league =
    todayBirthdays[0]?.league;

  const ownerPhone =
    String(
      league?.ownerWhatsAppNumber || ""
    ).trim();

  const ownerUserId =
    league?.ownerId ||
    preference.userId;

  /*
   * Use the first birthday as the unique annual anchor
   * for the owner summary. This prevents the cron from
   * sending the same owner summary repeatedly.
   */
  const firstBirthday =
    todayBirthdays[0];

  const ownerSmsUniqueWhere = {
    birthdayId_recipientUserId_birthdayYear_reminderType: {
      birthdayId: firstBirthday.id,
      recipientUserId: ownerUserId,
      birthdayYear: check.today.year,
      reminderType: "WHATSAPP",
    },
  };

  const existingOwnerSmsLog =
    await prisma.birthdayReminderLog.findUnique({
      where: ownerSmsUniqueWhere,
      select: {
        id: true,
        status: true,
      },
    });

  if (
    existingOwnerSmsLog?.status === "SENT" ||
    existingOwnerSmsLog?.status === "SHARED"
  ) {
    ownerSmsSkipped += 1;
  } else if (!ownerPhone) {
    ownerSmsSkipped += 1;

    console.log(
      "[BIRTHDAY_OWNER_SMS_SKIPPED]",
      {
        leagueId: preference.leagueId,
        reason:
          "League owner phone number is missing.",
      }
    );
  } else {
    const ownerSmsLog =
      await prisma.birthdayReminderLog.upsert({
        where: ownerSmsUniqueWhere,

        create: {
          birthdayId: firstBirthday.id,
          leagueId: preference.leagueId,
          recipientUserId: ownerUserId,
          birthdayYear: check.today.year,
          reminderType: "WHATSAPP",
          status: "PENDING",
          recipientPhone: ownerPhone,
          notificationTitle:
            "Cric4All birthday summary",
          notificationBody:
            `${todayBirthdays.length} birthday reminder(s) for today.`,
        },

        update: {
          status: "PENDING",
          recipientPhone: ownerPhone,
          errorMessage: null,
          sentAt: null,
        },
      });

    try {
      const ownerSmsResult =
        await sendBirthdayOwnerSms({
          ownerPhone,

          birthdays: todayBirthdays.map(
            (birthday) => ({
              birthdayId: birthday.id,
              leagueId: birthday.leagueId,

              leagueName:
                birthday.league?.name ||
                "Cric4All League",

              playerName:
                birthday.player?.name ||
                birthday.name ||
                "Player",
            })
          ),

          date:
            DateTime.fromObject(
              {
                year: check.today.year,
                month: check.today.month,
                day: check.today.day,
              },
              {
                zone: preference.timeZone,
              }
            ).toISODate(),
        });

      await prisma.birthdayReminderLog.update({
        where: {
          id: ownerSmsLog.id,
        },

        data: {
          status: "SENT",
          sentAt: new Date(),
          providerMessageId:
            ownerSmsResult.messageId,
          providerStatus:
            ownerSmsResult.status || "queued",
          errorMessage: null,
        },
      });

      ownerSmsSent += 1;
    } catch (ownerSmsError) {
      ownerSmsFailed += 1;

 const attemptTime = new Date();

const errorMessage =
  String(
    whatsappError instanceof Error
      ? whatsappError.message
      : whatsappError
  ).slice(0, 1000);

await prisma.birthdayReminderLog.update({
  where: {
    id: playerWhatsAppLog.id,
  },

  data: {
    status: "FAILED",

    providerStatus: "FAILED",

    lastAttemptAt: attemptTime,

    errorMessage,
  },
});

      console.error(
        "[BIRTHDAY_OWNER_SMS_FAILED]",
        {
          leagueId: preference.leagueId,
          error: errorMessage,
        }
      );
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

  preferenceCount:
    preferences.length,

  checkedPreferences,
  skippedPreferences,

  push: {
    sent:
      sentReminders,

    failed:
      failedReminders,
  },

  ownerSms: {
    sent:
      ownerSmsSent,

    skipped:
      ownerSmsSkipped,

    failed:
      ownerSmsFailed,
  },

  playerWhatsApp: {
    queued:
      playerWhatsAppQueued,

    skipped:
      playerWhatsAppSkipped,

    duplicates: duplicatePlayerWhatsApps,  

    failed:
      playerWhatsAppFailed,
  },
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