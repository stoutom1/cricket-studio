import { NextResponse } from "next/server";
import { DateTime } from "luxon";

import prisma from "@/lib/prisma";

import {
  birthdayWhereForDate,
  getLocalBirthdayCheck,
} from "@/lib/birthdayDates";

import {
  sendBirthdayPush,
} from "@/lib/sendBirthdayPush";

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
  const secret =
    process.env.CRON_SECRET;

  if (!secret) {
    return false;
  }

  const authorization =
    request.headers.get(
      "authorization"
    );

  return (
    authorization ===
    `Bearer ${secret}`
  );
}

function getErrorMessage(error) {
  return String(
    error instanceof Error
      ? error.message
      : error
  ).slice(0, 1000);
}

function getBirthdayPlayerName(
  birthday
) {
  return (
    birthday?.player?.name?.trim() ||
    birthday?.name?.trim() ||
    "Player"
  );
}

function shouldSkipExistingLog(log) {
  return (
    log?.status === "SENT" ||
    log?.status === "SHARED" ||
    log?.status === "PENDING"
  );
}

/*
 * Sends a push notification to the user who owns
 * the birthday notification preference.
 */
async function createAndSendPushReminder({
  birthday,
  preference,
  reminderType,
  birthdayYear,
}) {
  const uniqueWhere = {
    birthdayId_recipientUserId_birthdayYear_reminderType:
      {
        birthdayId:
          birthday.id,

        recipientUserId:
          preference.userId,

        birthdayYear,

        reminderType,
      },
  };

  const existing =
    await prisma.birthdayReminderLog
      .findUnique({
        where: uniqueWhere,

        select: {
          id: true,
          status: true,
        },
      });

  if (shouldSkipExistingLog(existing)) {
    return {
      skipped: true,
      reason:
        "Push reminder already processed.",
    };
  }

  const isToday =
    reminderType ===
    "BIRTHDAY_TODAY";

  const playerName =
    getBirthdayPlayerName(
      birthday
    );

  const title = isToday
    ? "🎂 Birthday Today"
    : "🎂 Birthday Tomorrow";

  const body = isToday
    ? `Today is ${playerName}'s birthday. Tap to prepare and share the league wish.`
    : `${playerName}'s birthday is tomorrow. Tap to prepare the birthday wish.`;

  const url =
    `/leagues/${birthday.leagueId}/birthdays/today` +
    `?birthdayId=${birthday.id}`;

  const log =
    await prisma.birthdayReminderLog
      .upsert({
        where: uniqueWhere,

        create: {
          birthdayId:
            birthday.id,

          leagueId:
            birthday.leagueId,

          recipientUserId:
            preference.userId,

          birthdayYear,

          reminderType,

          status:
            "PENDING",

          notificationTitle:
            title,

          notificationBody:
            body,
        },

        update: {
          status:
            "PENDING",

          errorMessage:
            null,

          notificationTitle:
            title,

          notificationBody:
            body,

          sentAt:
            null,
        },
      });

  try {
    const result =
      await sendBirthdayPush({
        recipientUserId:
          preference.userId,

        title,
        body,
        url,
      });

    if (result.noDevices) {
      await prisma
        .birthdayReminderLog
        .update({
          where: {
            id: log.id,
          },

          data: {
            status:
              "FAILED",

            errorMessage:
              "No enabled push device is registered.",
          },
        });

return {
  sent: false,
  skipped: true,
  reason: "NO_DEVICE",
};
    }

    if (result.sentCount === 0) {
      throw new Error(
        "All push-delivery attempts failed."
      );
    }

    await prisma
      .birthdayReminderLog
      .update({
        where: {
          id: log.id,
        },

        data: {
          status:
            "SENT",

          sentAt:
            new Date(),

          errorMessage:
            result.failedCount > 0
              ? `${result.failedCount} device delivery attempts failed.`
              : null,
        },
      });

    return {
      sent: true,
      sentCount:
        result.sentCount,
    };
  } catch (error) {
    const errorMessage =
      getErrorMessage(error);

    await prisma
      .birthdayReminderLog
      .update({
        where: {
          id: log.id,
        },

        data: {
          status:
            "FAILED",

          errorMessage,
        },
      });

    console.error(
      "[BIRTHDAY_PUSH_FAILED]",
      {
        birthdayId:
          birthday.id,

        recipientUserId:
          preference.userId,

        reminderType,

        userId: preference.userId,
      
      error:
        error instanceof Error
          ? error.message
          : String(error),
      }
    );

    return {
      sent: false,
      reason:
        "SEND_FAILED",
    };
  }
}

/*
 * Sends one SMS summary to the league owner,
 * regardless of how many birthdays exist today.
 */
async function sendOwnerBirthdaySummary({
  birthdays,
  preference,
  birthdayYear,
  birthdayDate,
}) {
  if (
    !Array.isArray(birthdays) ||
    birthdays.length === 0
  ) {
    return {
      skipped: true,
      reason:
        "NO_BIRTHDAYS",
    };
  }

  const league =
    birthdays[0]?.league;

  const ownerPhone =
    String(
      league?.ownerWhatsAppNumber ||
      ""
    ).trim();

  const ownerUserId =
    league?.ownerId ||
    preference.userId;

  if (!ownerPhone) {
    return {
      skipped: true,
      reason:
        "OWNER_PHONE_MISSING",
    };
  }

  const firstBirthday =
    birthdays[0];

  const uniqueWhere = {
    birthdayId_recipientUserId_birthdayYear_reminderType:
      {
        birthdayId:
          firstBirthday.id,

        recipientUserId:
          ownerUserId,

        birthdayYear,

        reminderType:
          "WHATSAPP",
      },
  };

  const existing =
    await prisma.birthdayReminderLog
      .findUnique({
        where: uniqueWhere,

        select: {
          id: true,
          status: true,
        },
      });

  if (shouldSkipExistingLog(existing)) {
    return {
      skipped: true,
      reason:
        "OWNER_SMS_ALREADY_PROCESSED",
    };
  }

  const notificationBody =
    birthdays.length === 1
      ? `One birthday is scheduled today in ${league?.name || "this league"}.`
      : `${birthdays.length} birthdays are scheduled today in ${league?.name || "this league"}.`;

  const log =
    await prisma.birthdayReminderLog
      .upsert({
        where: uniqueWhere,

        create: {
          birthdayId:
            firstBirthday.id,

          leagueId:
            preference.leagueId,

          recipientUserId:
            ownerUserId,

          birthdayYear,

          reminderType:
            "WHATSAPP",

          status:
            "PENDING",

          recipientPhone:
            ownerPhone,

          notificationTitle:
            "Cric4All birthday summary",

          notificationBody,
        },

        update: {
          status:
            "PENDING",

          recipientPhone:
            ownerPhone,

          notificationTitle:
            "Cric4All birthday summary",

          notificationBody,

          providerMessageId:
            null,

          providerStatus:
            null,

          errorMessage:
            null,

          sentAt:
            null,
        },
      });

  try {
    const result =
      await sendBirthdayOwnerSms({
        ownerPhone,

        birthdays:
          birthdays.map(
            (birthday) => ({
              birthdayId:
                birthday.id,

              leagueId:
                birthday.leagueId,

              leagueName:
                birthday.league?.name ||
                "Cric4All League",

              playerName:
                getBirthdayPlayerName(
                  birthday
                ),
            })
          ),

        date:
          birthdayDate,
      });

    await prisma
      .birthdayReminderLog
      .update({
        where: {
          id: log.id,
        },

        data: {
          status:
            "SENT",

          sentAt:
            new Date(),

          providerMessageId:
            result.messageId,

          providerStatus:
            result.status ||
            "queued",

          errorMessage:
            null,
        },
      });

    console.log(
      "[BIRTHDAY_OWNER_SMS_SENT]",
      {
        leagueId:
          preference.leagueId,

        birthdayCount:
          birthdays.length,

        messageId:
          result.messageId,

        status:
          result.status,
      }
    );

    return {
      sent: true,
      messageId:
        result.messageId,
    };
  } catch (error) {
    const errorMessage =
      getErrorMessage(error);

    await prisma
      .birthdayReminderLog
      .update({
        where: {
          id: log.id,
        },

        data: {
          status:
            "FAILED",

          providerStatus:
            "failed",

          errorMessage,
        },
      });

    console.error(
      "[BIRTHDAY_OWNER_SMS_FAILED]",
      {
        leagueId:
          preference.leagueId,

        error:
          errorMessage,
      }
    );

    return {
      sent: false,
      reason:
        "SEND_FAILED",
    };
  }
}

/*
 * Sends a birthday WhatsApp template to one
 * opted-in birthday player.
 */
async function sendPlayerBirthdayWhatsApp({
  birthday,
  preference,
  birthdayYear,
}) {
  const playerName =
    getBirthdayPlayerName(
      birthday
    );

  const recipientPhone =
    String(
      birthday.whatsappNumber ||
      birthday.player
        ?.whatsappNumber ||
      ""
    ).trim();

  const whatsappOptIn =
    birthday.whatsappOptIn ===
      true ||
    birthday.player
      ?.whatsappOptIn ===
      true;

  const leagueWhatsAppEnabled =
    birthday.league
      ?.whatsappNotificationsEnabled ===
    true;

  if (!leagueWhatsAppEnabled) {
    return {
      skipped: true,
      reason:
        "LEAGUE_WHATSAPP_DISABLED",
    };
  }

  if (!whatsappOptIn) {
    return {
      skipped: true,
      reason:
        "PLAYER_NOT_OPTED_IN",
    };
  }

  if (!recipientPhone) {
    return {
      skipped: true,
      reason:
        "PLAYER_PHONE_MISSING",
    };
  }

  const ownerUserId =
    birthday.league?.ownerId ||
    preference.userId;

  const uniqueWhere = {
    birthdayId_recipientUserId_birthdayYear_reminderType:
      {
        birthdayId:
          birthday.id,

        recipientUserId:
          ownerUserId,

        birthdayYear,

        reminderType:
          "PLAYER_WHATSAPP",
      },
  };

  const existing =
    await prisma.birthdayReminderLog
      .findUnique({
        where: uniqueWhere,

        select: {
          id: true,
          status: true,
          providerStatus: true,
        },
      });

  if (shouldSkipExistingLog(existing)) {
    return {
      skipped: true,
      reason:
        "PLAYER_WHATSAPP_ALREADY_PROCESSED",
    };
  }

  const leagueName =
    birthday.league?.name ||
    "Cric4All League";

  const log =
    await prisma.birthdayReminderLog
      .upsert({
        where: uniqueWhere,

        create: {
          birthdayId:
            birthday.id,

          leagueId:
            birthday.leagueId,

          recipientUserId:
            ownerUserId,

          birthdayYear,

          reminderType:
            "PLAYER_WHATSAPP",

          status:
            "PENDING",

          recipientPhone,

          notificationTitle:
            `Birthday greeting for ${playerName}`,

          notificationBody:
            `Birthday greeting from ${leagueName}.`,
        },

        update: {
          status:
            "PENDING",

          recipientPhone,

          notificationTitle:
            `Birthday greeting for ${playerName}`,

          notificationBody:
            `Birthday greeting from ${leagueName}.`,

          providerMessageId:
            null,

          providerStatus:
            null,

          errorMessage:
            null,

          sentAt:
            null,
        },
      });

  try {
    const result =
      await sendTwilioWhatsAppBirthdayMessage({
        recipientPhone,
        playerName,
        leagueName,

        birthdayId:
          birthday.id,

        leagueId:
          birthday.leagueId,
      });

    /*
     * SENT means the cron successfully submitted
     * the message to Twilio.
     *
     * providerStatus records the current Twilio
     * lifecycle state, normally "queued".
     */
    await prisma
      .birthdayReminderLog
      .update({
        where: {
          id: log.id,
        },

        data: {
          status:
            "SENT",

          sentAt:
            new Date(),

          providerMessageId:
            result.messageSid,

          providerStatus:
            result.status ||
            "queued",

          errorMessage:
            null,
        },
      });

    console.log(
      "[BIRTHDAY_PLAYER_WHATSAPP_QUEUED]",
      {
        birthdayId:
          birthday.id,

        playerName,

        messageSid:
          result.messageSid,

        status:
          result.status,
      }
    );

    return {
      queued: true,
      messageSid:
        result.messageSid,
    };
  } catch (error) {
    const errorMessage =
      getErrorMessage(error);

    await prisma
      .birthdayReminderLog
      .update({
        where: {
          id: log.id,
        },

        data: {
          status:
            "FAILED",

          providerStatus:
            "failed",

          errorMessage,
        },
      });

    console.error(
      "[BIRTHDAY_PLAYER_WHATSAPP_FAILED]",
      {
        birthdayId:
          birthday.id,

        playerName,

        error:
          errorMessage,
      }
    );

    return {
      queued: false,
      reason:
        "SEND_FAILED",
    };
  }
}

export async function GET(request) {
  if (!authorizeCron(request)) {
    return NextResponse.json(
      {
        error:
          "Unauthorized cron request.",
      },
      {
        status: 401,
      }
    );
  }

  try {
    const now =
      DateTime.utc();

    const preferences =
      await prisma
        .birthdayNotificationPreference
        .findMany({
          where: {
            enabled:
              true,

            OR: [
              {
                notifyDayBefore:
                  true,
              },
              {
                notifyOnBirthday:
                  true,
              },
            ],
          },

          select: {
            userId:
              true,

            leagueId:
              true,

            notifyDayBefore:
              true,

            notifyOnBirthday:
              true,

            reminderHour:
              true,

            timeZone:
              true,
          },
        });

    let checkedPreferences =
      0;

    let skippedPreferences =
      0;

    let pushSent =
      0;

    let pushSkipped =
      0;

    let pushFailed =
      0;

    let ownerSmsSent =
      0;

    let ownerSmsSkipped =
      0;

    let ownerSmsFailed =
      0;

    let playerWhatsAppQueued =
      0;

    let playerWhatsAppSkipped =
      0;

    let playerWhatsAppFailed =
      0;

    let todayBirthdaysFound =
      0;

    let tomorrowBirthdaysFound =
      0;

    for (
      const preference
      of preferences
    ) {
      let check;

      try {
        check =
          getLocalBirthdayCheck({
            now,

            timeZone:
              preference.timeZone,

            reminderHour:
              preference.reminderHour,
          });
      } catch (error) {
        console.error(
          "[BIRTHDAY_INVALID_PREFERENCE]",
          {
            userId:
              preference.userId,

            leagueId:
              preference.leagueId,

            error:
              getErrorMessage(
                error
              ),
          }
        );

        pushFailed += 1;
        continue;
      }

      if (!check.shouldRun) {
        skippedPreferences +=
          1;

        continue;
      }

      checkedPreferences +=
        1;

      /*
       * Birthday-today processing.
       */
      if (
        preference.notifyOnBirthday
      ) {
        const todayBirthdays =
          await prisma
            .leagueBirthday
            .findMany({
              where: {
                leagueId:
                  preference.leagueId,

                isActive:
                  true,

                ...birthdayWhereForDate(
                  check.today.month,
                  check.today.day,
                  check.today.year
                ),
              },

              select: {
                id:
                  true,

                leagueId:
                  true,

                playerId:
                  true,

                name:
                  true,

                birthMonth:
                  true,

                birthDay:
                  true,

                whatsappNumber:
                  true,

                whatsappOptIn:
                  true,

                league: {
                  select: {
                    id:
                      true,

                    name:
                      true,

                    ownerId:
                      true,

                    ownerWhatsAppNumber:
                      true,

                    whatsappNotificationsEnabled:
                      true,
                  },
                },

                player: {
                  select: {
                    id:
                      true,

                    name:
                      true,

                    whatsappNumber:
                      true,

                    whatsappOptIn:
                      true,
                  },
                },
              },

              orderBy: {
                name:
                  "asc",
              },
            });

        todayBirthdaysFound +=
          todayBirthdays.length;

        if (
          todayBirthdays.length >
          0
        ) {
          const birthdayDate =
            DateTime.fromObject(
              {
                year:
                  check.today.year,

                month:
                  check.today.month,

                day:
                  check.today.day,
              },
              {
                zone:
                  preference.timeZone,
              }
            ).toISODate();

          /*
           * 1. Send one owner SMS summary first.
           */
          const ownerSmsResult =
            await sendOwnerBirthdaySummary({
              birthdays:
                todayBirthdays,

              preference,

              birthdayYear:
                check.today.year,

              birthdayDate,
            });

          if (
            ownerSmsResult.sent
          ) {
            ownerSmsSent +=
              1;
          } else if (
            ownerSmsResult.skipped
          ) {
            ownerSmsSkipped +=
              1;

            console.log(
              "[BIRTHDAY_OWNER_SMS_SKIPPED]",
              {
                leagueId:
                  preference.leagueId,

                reason:
                  ownerSmsResult.reason,
              }
            );
          } else {
            ownerSmsFailed +=
              1;
          }

          /*
           * 2. Send one push reminder per birthday.
           */
          for (
            const birthday
            of todayBirthdays
          ) {
            const pushResult =
              await createAndSendPushReminder({
                birthday,
                preference,

                reminderType:
                  "BIRTHDAY_TODAY",

                birthdayYear:
                  check.today.year,
              });

            if (pushResult.sent) {
              pushSent +=
                1;
            } else if (
              pushResult.skipped
            ) {
              pushSkipped +=
                1;
            } else {
              pushFailed +=
                1;
            }
          }

          /*
           * 3. Send a personal WhatsApp birthday
           * greeting to each opted-in player.
           */
          for (
            const birthday
            of todayBirthdays
          ) {
            const whatsappResult =
              await sendPlayerBirthdayWhatsApp({
                birthday,
                preference,

                birthdayYear:
                  check.today.year,
              });

            if (
              whatsappResult.queued
            ) {
              playerWhatsAppQueued +=
                1;
            } else if (
              whatsappResult.skipped
            ) {
              playerWhatsAppSkipped +=
                1;

              console.log(
                "[BIRTHDAY_PLAYER_WHATSAPP_SKIPPED]",
                {
                  birthdayId:
                    birthday.id,

                  playerName:
                    getBirthdayPlayerName(
                      birthday
                    ),

                  reason:
                    whatsappResult.reason,
                }
              );
            } else {
              playerWhatsAppFailed +=
                1;
            }
          }
        }
      }

      /*
       * Day-before push reminders.
       *
       * No owner SMS and no player WhatsApp are sent
       * for the day-before reminder.
       */
      if (
        preference.notifyDayBefore
      ) {
        const tomorrowBirthdays =
          await prisma
            .leagueBirthday
            .findMany({
              where: {
                leagueId:
                  preference.leagueId,

                isActive:
                  true,

                ...birthdayWhereForDate(
                  check.tomorrow.month,
                  check.tomorrow.day,
                  check.tomorrow.year
                ),
              },

              select: {
                id:
                  true,

                leagueId:
                  true,

                name:
                  true,

                birthMonth:
                  true,

                birthDay:
                  true,

                player: {
                  select: {
                    id:
                      true,

                    name:
                      true,
                  },
                },
              },

              orderBy: {
                name:
                  "asc",
              },
            });

        tomorrowBirthdaysFound +=
          tomorrowBirthdays.length;

        for (
          const birthday
          of tomorrowBirthdays
        ) {
          const pushResult =
            await createAndSendPushReminder({
              birthday,
              preference,

              reminderType:
                "DAY_BEFORE",

              birthdayYear:
                check.tomorrow.year,
            });

          if (pushResult.sent) {
            pushSent +=
              1;
          } else if (
            pushResult.skipped
          ) {
            pushSkipped +=
              1;
          } else {
            pushFailed +=
              1;
          }
        }
      }
    }

    return NextResponse.json({
      success:
        ownerSmsFailed === 0 &&
        playerWhatsAppFailed === 0,

      checkedAtUtc:
        now.toISO(),

      preferenceCount:
        preferences.length,

      checkedPreferences,
      skippedPreferences,

      birthdays: {
        todayFound:
          todayBirthdaysFound,

        tomorrowFound:
          tomorrowBirthdaysFound,
      },

      push: {
        sent:
          pushSent,

        skipped:
          pushSkipped,

        failed:
          pushFailed,
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

        failed:
          playerWhatsAppFailed,
      },
    });
  } catch (error) {
    const errorMessage =
      getErrorMessage(error);

    console.error(
      "[BIRTHDAY_REMINDER_CRON_FAILED]",
      {
        error:
          errorMessage,
      }
    );

    return NextResponse.json(
      {
        success:
          false,

        error:
          "Birthday reminder processing failed.",

        details:
          errorMessage,
      },
      {
        status:
          500,
      }
    );
  }
}