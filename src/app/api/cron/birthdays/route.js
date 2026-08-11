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
  sendBirthdayOwnerCommunication,
} from "@/lib/sendBirthdayOwnerCommunication";

import {
  sendTwilioWhatsAppBirthdayMessage,
} from "@/lib/sendTwilioWhatsAppBirthdayMessage";

import {
  sendPlayerCommunication,
} from "@/lib/communications/sendPlayerCommunication";

import {
  buildBirthdayCommunicationContent,
} from "@/lib/communications/templates/birthday";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function getCronSource(request) {
  const customSource =
    request.headers.get(
      "x-cron-source"
    );

  if (customSource) {
    return customSource;
  }

  const userAgent =
    request.headers.get(
      "user-agent"
    ) || "";

  if (
    userAgent
      .toLowerCase()
      .includes("cron-job.org")
  ) {
    return "cron-job.org";
  }

  if (
    request.headers.get(
      "x-vercel-cron"
    )
  ) {
    return "vercel-cron";
  }

  return "manual-or-unknown";
}

function getRequestIp(request) {
  const forwardedFor =
    request.headers.get(
      "x-forwarded-for"
    );

  return (
    forwardedFor
      ?.split(",")[0]
      ?.trim() ||
    request.headers.get(
      "x-real-ip"
    ) ||
    null
  );
}

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
 *
 * If WhatsApp later fails with Twilio error 63049,
 * the webhook may send an SMS fallback only when
 * fallbackSmsAllowed is true.
 */
async function sendPlayerBirthdayWhatsApp({
  birthday,
  preference,
  birthdayYear,
}) {
  const playerName =
    getBirthdayPlayerName(birthday);

  const recipientPhone = String(
    birthday.whatsappNumber ||
      birthday.player?.whatsappNumber ||
      ""
  ).trim();

  /*
   * Backward-compatible communication consent.
   *
   * The existing whatsappOptIn value now represents the
   * player's consent to receive Cric4All communications.
   * WhatsApp remains the primary transport and SMS may be
   * used only as an eligible fallback.
   */
  const communicationConsent =
    birthday.whatsappOptIn === true ||
    birthday.player?.whatsappOptIn === true;

  const leagueWhatsAppEnabled =
    birthday.league
      ?.whatsappNotificationsEnabled === true;

  if (!leagueWhatsAppEnabled) {
    return {
      skipped: true,
      reason: "LEAGUE_WHATSAPP_DISABLED",
    };
  }

  if (!communicationConsent) {
    return {
      skipped: true,
      reason: "PLAYER_NOT_OPTED_IN",
    };
  }

  if (!recipientPhone) {
    return {
      skipped: true,
      reason: "PLAYER_PHONE_MISSING",
    };
  }

  const ownerUserId =
    birthday.league?.ownerId ||
    preference.userId;

  const uniqueWhere = {
    birthdayId_recipientUserId_birthdayYear_reminderType: {
      birthdayId: birthday.id,
      recipientUserId: ownerUserId,
      birthdayYear,
      reminderType: "PLAYER_WHATSAPP",
    },
  };

  const existing =
    await prisma.birthdayReminderLog.findUnique({
      where: uniqueWhere,

      select: {
        id: true,
        status: true,
        providerStatus: true,

        fallbackSmsStatus: true,
        fallbackSmsMessageId: true,
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

  const communicationContent =
    buildBirthdayCommunicationContent({
      playerName,
      leagueName,
    });

  const fallbackSmsBody =
    communicationContent.fallbackSmsBody;

  /*
   * This flag controls whether error 63049 is
   * eligible for an SMS fallback.
   *
   * The environment flag gives you an emergency
   * off switch without requiring another deployment.
   */
  const fallbackFeatureEnabled =
    String(
      process.env
        .BIRTHDAY_SMS_FALLBACK_ENABLED ||
        ""
    )
      .trim()
      .toLowerCase() === "true";

const fallbackSmsAllowed =
    fallbackFeatureEnabled &&
    communicationConsent;

  const log =
    await prisma.birthdayReminderLog.upsert({
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

        /*
         * Step 4:
         * Store the SMS text and whether this
         * recipient has permission for fallback.
         */
        fallbackSmsBody,
        fallbackSmsAllowed,

        errorMessage:
          null,
      },

      update: {
        /*
         * A failed WhatsApp reminder may be
         * attempted again by the cron.
         */
        status:
          "PENDING",

        recipientPhone,

        notificationTitle:
          `Birthday greeting for ${playerName}`,

        notificationBody:
          `Birthday greeting from ${leagueName}.`,

        /*
         * Refresh the text and consent value.
         *
         * Do not clear fallbackSmsStatus,
         * fallbackSmsMessageId or fallback timestamps.
         * They provide duplicate protection.
         */
        fallbackSmsBody,
        fallbackSmsAllowed,

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
    const attemptTime =
      new Date();

    const result =
      await sendPlayerCommunication({
        type: "BIRTHDAY",
        consentGranted:
          communicationConsent,
        recipientPhone,
        fallbackEligible:
          fallbackSmsAllowed,
        fallbackBody:
          fallbackSmsBody,
        context: {
          birthdayId:
            birthday.id,
          leagueId:
            birthday.leagueId,
          playerName,
          leagueName,
        },
        sendPrimary: () =>
          sendTwilioWhatsAppBirthdayMessage({
            recipientPhone,
            playerName,
            leagueName,
            birthdayId:
              birthday.id,
            leagueId:
              birthday.leagueId,
          }),
      });

    /*
     * Twilio has accepted the message, but it has
     * not yet confirmed delivery. Keep the internal
     * status PENDING until the webhook receives a
     * terminal status.
     */
    await prisma.birthdayReminderLog.update({
      where: {
        id: log.id,
      },

      data: {
        status:
          "PENDING",

        sentAt:
          null,

        providerMessageId:
          result.messageSid,

        providerStatus:
          String(
            result.status ||
              "ACCEPTED"
          ).toUpperCase(),

        recipientPhone,

        lastAttemptAt:
          attemptTime,

        errorMessage:
          null,

        lastErrorCode:
          null,
      },
    });

    console.log(
      "[BIRTHDAY_PLAYER_WHATSAPP_QUEUED]",
      {
        reminderLogId:
          log.id,

        birthdayId:
          birthday.id,

        leagueId:
          birthday.leagueId,

        playerName,

        recipientPhone,

        messageSid:
          result.messageSid,

        providerStatus:
          String(
            result.status ||
              "ACCEPTED"
          ).toUpperCase(),

        fallbackSmsAllowed,

        attemptedAt:
          attemptTime.toISOString(),
      }
    );

    return {
      queued: true,

      messageSid:
        result.messageSid,

      fallbackSmsAllowed,
    };
  } catch (error) {
    const attemptTime =
      new Date();

    const errorMessage =
      getErrorMessage(error);

    await prisma.birthdayReminderLog.update({
      where: {
        id: log.id,
      },

      data: {
        status:
          "FAILED",

        providerStatus:
          "FAILED",

        lastAttemptAt:
          attemptTime,

        errorMessage,
      },
    });

    console.error(
      "[BIRTHDAY_PLAYER_WHATSAPP_FAILED]",
      {
        reminderLogId:
          log.id,

        birthdayId:
          birthday.id,

        leagueId:
          birthday.leagueId,

        playerName,

        recipientPhone,

        fallbackSmsAllowed,

        attemptedAt:
          attemptTime.toISOString(),

        error:
          errorMessage,
      }
    );

    return {
      queued: false,
      reason: "SEND_FAILED",
    };
  }
}

async function isBirthdayOwnerPreference(preference) {
  const league = await prisma.league.findUnique({
    where: { id: preference.leagueId },
    select: {
      ownerId: true,
      backupOwnerId: true,
    },
  });

  const userId = String(preference.userId || "");

  return Boolean(
    userId &&
    (
      String(league?.ownerId || "") === userId ||
      String(league?.backupOwnerId || "") === userId
    )
  );
}

function normalizePhoneKey(value) {
  return String(value || "").replace(/\D/g, "");
}

function getUniqueOwnerRecipients(league) {
  const candidates = [
    {
      label: "PRIMARY_OWNER",
      userId: league?.ownerId || null,
      phone: String(league?.ownerWhatsAppNumber || "").trim(),
    },
    {
      label: "BACKUP_OWNER",
      userId: league?.backupOwnerId || null,
      phone: String(league?.backupOwnerWhatsAppNumber || "").trim(),
    },
  ];

  const seenUsers = new Set();
  const seenPhones = new Set();
  const recipients = [];

  for (const candidate of candidates) {
    if (!candidate.userId || !candidate.phone) {
      continue;
    }

    const userKey = String(candidate.userId);
    const phoneKey = normalizePhoneKey(candidate.phone);

    if (seenUsers.has(userKey) || (phoneKey && seenPhones.has(phoneKey))) {
      continue;
    }

    seenUsers.add(userKey);
    if (phoneKey) seenPhones.add(phoneKey);
    recipients.push(candidate);
  }

  return recipients;
}

async function sendBirthdayTodayOwnerSmsSummaries({
  birthdays,
  preference,
  birthdayYear,
  birthdayDate,
}) {
  if (
    !Array.isArray(birthdays) ||
    birthdays.length === 0
  ) {
    return [];
  }

  const league =
    birthdays[0]?.league;

  if (
    league?.whatsappNotificationsEnabled !==
    true
  ) {
    return [
      {
        skipped: true,
        reason:
          "OWNER_REMINDERS_DISABLED",
      },
    ];
  }

  const recipients =
    getUniqueOwnerRecipients(
      league
    );

  if (
    recipients.length === 0
  ) {
    return [
      {
        skipped: true,
        reason:
          "OWNER_RECIPIENTS_MISSING",
      },
    ];
  }

  const results = [];

  /*
   * One forward-ready birthday message per birthday player,
   * per unique Primary/Backup Owner.
   *
   * WhatsApp is always attempted first.
   * SMS is the automatic fallback.
   */
  for (
    const birthday of birthdays
  ) {
    for (
      const recipient of recipients
    ) {
      /*
       * Use the existing WHATSAPP enum value for the new owner
       * WhatsApp-first communication.
       *
       * This deliberately does NOT reuse the old OWNER_SMS reminder
       * key, so historical owner SMS logs cannot suppress today's
       * new WhatsApp-first message.
       */
      const uniqueWhere = {
        birthdayId_recipientUserId_birthdayYear_reminderType:
          {
            birthdayId:
              birthday.id,

            recipientUserId:
              recipient.userId,

            birthdayYear,

            reminderType:
              "WHATSAPP",
          },
      };

      const existing =
        await prisma
          .birthdayReminderLog
          .findUnique({
            where:
              uniqueWhere,

            select: {
              id: true,
              status: true,
              fallbackSmsMessageId:
                true,
            },
          });

      if (
        shouldSkipExistingLog(
          existing
        )
      ) {
        results.push({
          skipped: true,
          reason:
            "OWNER_BIRTHDAY_ALREADY_PROCESSED",
          recipientLabel:
            recipient.label,
          birthdayId:
            birthday.id,
        });

        continue;
      }

      const playerName =
        getBirthdayPlayerName(
          birthday
        );

      const leagueName =
        birthday.league?.name ||
        league?.name ||
        "Cric4All League";

      const log =
        await prisma
          .birthdayReminderLog
          .upsert({
            where:
              uniqueWhere,

            create: {
              birthdayId:
                birthday.id,

              leagueId:
                preference.leagueId,

              recipientUserId:
                recipient.userId,

              birthdayYear,

              reminderType:
                "WHATSAPP",

              status:
                "PENDING",

              recipientPhone:
                recipient.phone,

              notificationTitle:
                `🎂 Birthday message for ${playerName}`,

              notificationBody:
                `Happy Birthday, ${playerName}!`,

              fallbackSmsAllowed:
                true,

              fallbackSmsStatus:
                null,

              fallbackSmsMessageId:
                null,

              fallbackSmsError:
                null,
            },

            update: {
              status:
                "PENDING",

              recipientPhone:
                recipient.phone,

              notificationTitle:
                `🎂 Birthday message for ${playerName}`,

              notificationBody:
                `Happy Birthday, ${playerName}!`,

              providerMessageId:
                null,

              providerStatus:
                null,

              errorMessage:
                null,

              sentAt:
                null,

              callbackReceivedAt:
                null,

              lastCallbackAt:
                null,

              fallbackSmsAllowed:
                true,

              fallbackSmsStatus:
                null,

              fallbackSmsMessageId:
                null,

              fallbackSmsAttemptedAt:
                null,

              fallbackSmsQueuedAt:
                null,

              fallbackSmsError:
                null,
            },
          });

      try {
        const result =
          await sendBirthdayOwnerCommunication({
            ownerPhone:
              recipient.phone,

            playerName,

            leagueName,

            birthdayId:
              birthday.id,

            leagueId:
              preference.leagueId,

            reminderLogId:
              log.id,
          });

        if (
          result.channel ===
          "SMS"
        ) {
          /*
           * WhatsApp was rejected immediately and SMS was
           * accepted. Store the fallback result directly.
           */
          await prisma
            .birthdayReminderLog
            .update({
              where: {
                id:
                  log.id,
              },

              data: {
                status:
                  "SENT",

                sentAt:
                  new Date(),

                providerStatus:
                  "WHATSAPP_IMMEDIATE_FAILURE",

                errorMessage:
                  result.whatsappError ||
                  null,

                fallbackSmsAttemptedAt:
                  new Date(),

                fallbackSmsQueuedAt:
                  new Date(),

                fallbackSmsStatus:
                  result.status ||
                  "ACCEPTED",

                fallbackSmsMessageId:
                  result.messageId,

                fallbackSmsError:
                  null,
              },
            });
        } else {
          /*
           * WhatsApp was accepted by Twilio.
           *
           * Keep this PENDING until the callback reports a
           * delivery outcome. If the callback has already
           * triggered an SMS fallback, updateMany's condition
           * prevents this response from overwriting it.
           */
          await prisma
            .birthdayReminderLog
            .updateMany({
              where: {
                id:
                  log.id,

                fallbackSmsMessageId:
                  null,
              },

              data: {
                status:
                  "PENDING",

                providerMessageId:
                  result.messageId,

                providerStatus:
                  result.status ||
                  "QUEUED",

                errorMessage:
                  null,

                callbackExpectedAt:
                  new Date(
                    Date.now() +
                    12 *
                    60 *
                    60 *
                    1000
                  ),
              },
            });
        }

        results.push({
          sent: true,
          recipientLabel:
            recipient.label,
          birthdayId:
            birthday.id,
          playerName,
          messageId:
            result.messageId,
          channel:
            result.channel,
          fallbackUsed:
            result.fallbackUsed,
        });
      } catch (error) {
        const errorMessage =
          getErrorMessage(
            error
          );

        await prisma
          .birthdayReminderLog
          .update({
            where: {
              id:
                log.id,
            },

            data: {
              status:
                "FAILED",

              providerStatus:
                "FAILED",

              errorMessage,

              fallbackSmsAttemptedAt:
                new Date(),

              fallbackSmsStatus:
                "FAILED",

              fallbackSmsError:
                errorMessage,
            },
          });

        console.error(
          "[BIRTHDAY_OWNER_ALL_CHANNELS_FAILED]",
          {
            leagueId:
              preference.leagueId,

            birthdayId:
              birthday.id,

            playerName,

            recipientLabel:
              recipient.label,

            recipientUserId:
              recipient.userId,

            error:
              errorMessage,
          }
        );

        results.push({
          sent: false,
          recipientLabel:
            recipient.label,
          birthdayId:
            birthday.id,
          playerName,
          reason:
            "WHATSAPP_AND_SMS_FAILED",
        });
      }
    }
  }

  return results;
}

async function handler(request) {
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

  const cronStartedAt =
    new Date();

  const cronSource =
    getCronSource(request);

  console.log(
    "[BIRTHDAY_CRON_STARTED]",
    {
      startedAt:
        cronStartedAt.toISOString(),

      source:
        cronSource,

      userAgent:
        request.headers.get(
          "user-agent"
        ),

      requestIp:
        getRequestIp(request),

      requestUrl:
        request.url,
    }
  );

  try {
    const now =
      DateTime.fromJSDate(
        cronStartedAt,
        {
          zone: "utc",
        }
      );

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
  id: true,
  leagueId: true,
  playerId: true,
  name: true,
  birthMonth: true,
  birthDay: true,

  whatsappNumber: true,
  whatsappOptIn: true,

  smsOptIn: true,
  smsOptInAt: true,
  smsOptOutAt: true,

  league: {
    select: {
      id: true,
      name: true,
      ownerId: true,
      backupOwnerId: true,
      ownerWhatsAppNumber: true,
      backupOwnerWhatsAppNumber: true,
      whatsappNotificationsEnabled: true,
    },
  },

  player: {
    select: {
      id: true,
      name: true,

      whatsappNumber: true,
      whatsappOptIn: true,

      smsOptIn: true,
      smsOptInAt: true,
      smsOptOutAt: true,
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
           * CURRENT-DAY OWNER RULE
           *
           * Owners need the reminder on the actual birthday so they can
           * immediately forward/share it with the players group.
           *
           * Send to:
           *   1. Primary League Owner
           *   2. Backup League Owner (when configured)
           *
           * Do not send any owner reminder the day before.
           */
          if (await isBirthdayOwnerPreference(preference)) {
            for (const birthday of todayBirthdays) {
              const pushResult =
                await createAndSendPushReminder({
                  birthday,
                  preference,
                  reminderType: "BIRTHDAY_TODAY",
                  birthdayYear: check.today.year,
                });

              if (pushResult.sent) {
                pushSent += 1;
              } else if (pushResult.skipped) {
                pushSkipped += 1;
              } else {
                pushFailed += 1;
              }
            }

            const ownerSmsResults =
              await sendBirthdayTodayOwnerSmsSummaries({
                birthdays: todayBirthdays,
                preference,
                birthdayYear: check.today.year,
                birthdayDate,
              });

            for (const ownerSmsResult of ownerSmsResults) {
              if (ownerSmsResult.sent) {
                ownerSmsSent += 1;
              } else if (ownerSmsResult.skipped) {
                ownerSmsSkipped += 1;
              } else {
                ownerSmsFailed += 1;
              }
            }
          }

          /*
           * Send the personal birthday greeting directly to each
           * opted-in birthday player on the actual birthday.
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
       * DAY-BEFORE RULE
       *
       * Intentionally send NOTHING.
       *
       * Owner reminders now go out on the player's actual birthday,
       * at the same scheduled cron run as the player's personal greeting.
       * This lets the Primary/Backup Owner immediately forward the
       * reminder to the players group.
       *
       * We keep notifyDayBefore in the preference model for backward
       * compatibility, but this cron no longer sends day-before messages.
       */

    }

    const cronCompletedAt =
      new Date();

    const summary = {
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
    };

    console.log(
      "[BIRTHDAY_CRON_COMPLETED]",
      {
        startedAt:
          cronStartedAt.toISOString(),

        completedAt:
          cronCompletedAt.toISOString(),

        durationMs:
          cronCompletedAt.getTime() -
          cronStartedAt.getTime(),

        source:
          cronSource,

        ...summary,
      }
    );

    return NextResponse.json({
      source:
        cronSource,

      startedAt:
        cronStartedAt.toISOString(),

      completedAt:
        cronCompletedAt.toISOString(),

      durationMs:
        cronCompletedAt.getTime() -
        cronStartedAt.getTime(),

      ...summary,
    });
  } catch (error) {
    const cronFailedAt =
      new Date();

    const errorMessage =
      getErrorMessage(error);

    console.error(
      "[BIRTHDAY_CRON_FAILED]",
      {
        startedAt:
          cronStartedAt.toISOString(),

        failedAt:
          cronFailedAt.toISOString(),

        durationMs:
          cronFailedAt.getTime() -
          cronStartedAt.getTime(),

        source:
          cronSource,

        error:
          errorMessage,

        stack:
          error instanceof Error
            ? error.stack
            : null,
      }
    );

    return NextResponse.json(
      {
        success:
          false,

        source:
          cronSource,

        startedAt:
          cronStartedAt.toISOString(),

        completedAt:
          cronFailedAt.toISOString(),

        durationMs:
          cronFailedAt.getTime() -
          cronStartedAt.getTime(),

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

export async function GET(request) {
  return handler(request);
}

export async function POST(request) {
  return handler(request);
}
