import { NextResponse } from "next/server";

import prisma from "@/lib/prisma";
import {
  sendWebPushNotification,
} from "@/lib/web-push";
import {
  sendTwilioWhatsAppBirthdayMessage,
} from "@/lib/sendTwilioWhatsAppBirthdayMessage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getDatePartsInTimeZone(
  date,
  timeZone
) {
  const formatter =
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "numeric",
      day: "numeric",
    });

  const parts =
    formatter.formatToParts(date);

  const values =
    Object.fromEntries(
      parts
        .filter(
          (part) =>
            part.type !== "literal"
        )
        .map((part) => [
          part.type,
          part.value,
        ])
    );

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
  };
}

function formatDateKey({
  year,
  month,
  day,
}) {
  return [
    String(year).padStart(4, "0"),
    String(month).padStart(2, "0"),
    String(day).padStart(2, "0"),
  ].join("-");
}

function getErrorMessage(error) {
  return error instanceof Error
    ? error.message
    : "Unknown error.";
}

function groupBirthdaysByLeague(
  birthdays
) {
  const grouped = new Map();

  for (const birthday of birthdays) {
    const leagueId =
      birthday.league?.id;

    if (!leagueId) {
      continue;
    }

    if (!grouped.has(leagueId)) {
      grouped.set(leagueId, {
        leagueId,

        leagueName:
          birthday.league?.name?.trim() ||
          "Cric4All League",

        ownerId:
          birthday.league?.ownerId ??
          null,

        ownerWhatsAppNumber:
          birthday.league
            ?.ownerWhatsAppNumber ??
          null,

        whatsappNotificationsEnabled:
          Boolean(
            birthday.league
              ?.whatsappNotificationsEnabled
          ),

        birthdays: [],
      });
    }

    grouped
      .get(leagueId)
      .birthdays
      .push({
        birthdayId:
          birthday.id,

        playerId:
          birthday.player?.id ??
          null,

        playerName:
          birthday.player?.name?.trim() ||
          birthday.name?.trim() ||
          "Player",
      });
  }

  return [...grouped.values()];
}

function createNotificationBody(
  birthdays
) {
  const names = birthdays
    .map(
      (birthday) =>
        birthday.playerName
    )
    .filter(Boolean);

  if (names.length === 1) {
    return `${names[0]} is celebrating a birthday today. Tap to prepare and share a birthday wish.`;
  }

  if (names.length === 2) {
    return `${names[0]} and ${names[1]} are celebrating birthdays today.`;
  }

  const firstNames =
    names.slice(0, 2).join(", ");

  return `${firstNames} and ${
    names.length - 2
  } more players are celebrating birthdays today.`;
}

export async function GET(request) {
  const startedAt = new Date();

  try {
    /*
     * 1. Protect the cron route.
     */
    const authorization =
      request.headers.get(
        "authorization"
      );

    const cronSecret =
      process.env.CRON_SECRET;

    if (
      !cronSecret ||
      authorization !==
        `Bearer ${cronSecret}`
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized.",
        },
        {
          status: 401,
        }
      );
    }

    /*
     * 2. Determine today's date.
     */
    const timeZone =
      process.env
        .BIRTHDAY_TIME_ZONE ||
      "America/Los_Angeles";

    const today =
      getDatePartsInTimeZone(
        new Date(),
        timeZone
      );

    const sentDate =
      formatDateKey(today);

    console.log(
      "[BIRTHDAY_CRON_START]",
      {
        startedAt:
          startedAt.toISOString(),
        timeZone,
        sentDate,
        month: today.month,
        day: today.day,
      }
    );

    /*
     * 3. Find today's active birthdays.
     */
    const birthdays =
      await prisma
        .leagueBirthday
        .findMany({
          where: {
            isActive: true,
            birthMonth:
              today.month,
            birthDay:
              today.day,
          },

          select: {
            id: true,
            name: true,

            league: {
              select: {
                id: true,
                name: true,
                ownerId: true,

                ownerWhatsAppNumber:
                  true,

                whatsappNotificationsEnabled:
                  true,
              },
            },

            player: {
              select: {
                id: true,
                name: true,
              },
            },
          },

          orderBy: [
            {
              league: {
                name: "asc",
              },
            },
            {
              name: "asc",
            },
          ],
        });

    console.log(
      "[BIRTHDAY_CRON_BIRTHDAYS]",
      {
        count:
          birthdays.length,

        birthdays:
          birthdays.map(
            (birthday) => ({
              birthdayId:
                birthday.id,

              playerName:
                birthday.player?.name ||
                birthday.name,

              leagueId:
                birthday.league?.id,

              leagueName:
                birthday.league?.name,
            })
          ),
      }
    );

    /*
     * 4. Nothing needs to be sent.
     */
    if (
      birthdays.length === 0
    ) {
      console.log(
        "[BIRTHDAY_CRON_COMPLETE]",
        {
          sentDate,
          birthdaysFound: 0,
          notificationsSent: 0,
          reason:
            "No birthdays today.",
        }
      );

      return NextResponse.json({
        success: true,
        date: sentDate,
        timeZone,
        birthdaysFound: 0,
        leaguesProcessed: 0,

        notificationsAttempted: 0,
        notificationsSent: 0,
        notificationsFailed: 0,

        whatsappAttempted: 0,
        whatsappSent: 0,
        whatsappFailed: 0,
        whatsappSkipped: 0,

        message:
          "No active birthdays were found today.",
      });
    }

    /*
     * 5. Group birthdays by league.
     */
    const leagueGroups =
      groupBirthdaysByLeague(
        birthdays
      );

    const leagueIds =
      leagueGroups.map(
        (group) =>
          group.leagueId
      );

    /*
     * 6. Find eligible Web Push recipients.
     *
     * This preserves the existing behavior:
     * Web Push is sent to league members
     * whose role is OWNER.
     */
    const leagueRecipients =
      await prisma
        .leagueMember
        .findMany({
          where: {
            leagueId: {
              in: leagueIds,
            },

            role: {
              in: ["OWNER"],
            },
          },

          select: {
            leagueId: true,
            userId: true,
          },
        });

    const recipientUserIds = [
      ...new Set(
        leagueRecipients.map(
          (recipient) =>
            recipient.userId
        )
      ),
    ];

    console.log(
      "[BIRTHDAY_CRON_RECIPIENTS]",
      {
        leagueRecipientCount:
          leagueRecipients.length,

        recipientUserCount:
          recipientUserIds.length,

        recipients:
          leagueRecipients,
      }
    );

    /*
     * Do not return early when there are no
     * Web Push recipients.
     *
     * WhatsApp processing must still be allowed.
     */

    /*
     * 7. Load active Web Push subscriptions.
     */
    const subscriptions =
      recipientUserIds.length > 0
        ? await prisma
            .webPushSubscription
            .findMany({
              where: {
                userId: {
                  in:
                    recipientUserIds,
                },

                isActive: true,
              },

              select: {
                id: true,
                userId: true,
                endpoint: true,
                p256dh: true,
                auth: true,
              },
            })
        : [];

    console.log(
      "[BIRTHDAY_CRON_SUBSCRIPTIONS]",
      {
        activeSubscriptionCount:
          subscriptions.length,
      }
    );

    let notificationsAttempted = 0;
    let notificationsSent = 0;
    let notificationsFailed = 0;

    let whatsappAttempted = 0;
    let whatsappSent = 0;
    let whatsappFailed = 0;
    let whatsappSkipped = 0;

    const deliveryResults = [];
    const whatsappDeliveryResults = [];

    /*
     * 8. Process each league.
     */
    for (
      const leagueGroup
      of leagueGroups
    ) {
      /*
       * Existing Web Push section.
       */
      const eligibleUserIds =
        new Set(
          leagueRecipients
            .filter(
              (recipient) =>
                recipient.leagueId ===
                leagueGroup.leagueId
            )
            .map(
              (recipient) =>
                recipient.userId
            )
        );

      const leagueSubscriptions =
        subscriptions.filter(
          (subscription) =>
            eligibleUserIds.has(
              subscription.userId
            )
        );

      const birthdayCount =
        leagueGroup
          .birthdays
          .length;

      const payload = {
        title:
          birthdayCount === 1
            ? `🎂 Birthday today in ${leagueGroup.leagueName}`
            : `🎂 ${birthdayCount} birthdays today in ${leagueGroup.leagueName}`,

        body:
          createNotificationBody(
            leagueGroup.birthdays
          ),

        icon:
          "/icons/icon-192x192.png",

        badge:
          "/icons/icon-96x96.png",

        tag:
          `birthday-${leagueGroup.leagueId}-${sentDate}`,

        renotify: false,

        url:
          `/leagues/${leagueGroup.leagueId}/birthdays/today`,

        data: {
          type:
            "LEAGUE_BIRTHDAY",

          leagueId:
            leagueGroup.leagueId,

          date:
            sentDate,

          url:
            `/leagues/${leagueGroup.leagueId}/birthdays/today`,
        },
      };

      console.log(
        "[BIRTHDAY_CRON_LEAGUE]",
        {
          leagueId:
            leagueGroup.leagueId,

          leagueName:
            leagueGroup.leagueName,

          birthdayCount,

          subscriptionCount:
            leagueSubscriptions.length,
        }
      );

      /*
       * Existing browser/device Web Push loop.
       */
      for (
        const subscription
        of leagueSubscriptions
      ) {
        notificationsAttempted += 1;

        try {
          const sendResult =
            await sendWebPushNotification({
              subscription,
              payload,
            });

          notificationsSent += 1;

          deliveryResults.push({
            success: true,

            leagueId:
              leagueGroup.leagueId,

            subscriptionId:
              subscription.id,

            statusCode:
              sendResult?.statusCode ??
              201,
          });

          console.log(
            "[BIRTHDAY_CRON_PUSH_SUCCESS]",
            {
              leagueId:
                leagueGroup.leagueId,

              subscriptionId:
                subscription.id,

              statusCode:
                sendResult?.statusCode ??
                201,
            }
          );

          /*
           * Preserve existing last-used update.
           */
          await prisma
            .webPushSubscription
            .update({
              where: {
                id:
                  subscription.id,
              },

              data: {
                lastUsedAt:
                  new Date(),
              },
            });
        } catch (pushError) {
          notificationsFailed += 1;

          const statusCode =
            pushError?.statusCode ??
            null;

          const errorMessage =
            getErrorMessage(
              pushError
            );

          deliveryResults.push({
            success: false,

            leagueId:
              leagueGroup.leagueId,

            subscriptionId:
              subscription.id,

            statusCode,

            error:
              errorMessage,
          });

          console.error(
            "[BIRTHDAY_CRON_PUSH_FAILED]",
            {
              leagueId:
                leagueGroup.leagueId,

              subscriptionId:
                subscription.id,

              statusCode,

              error:
                errorMessage,
            }
          );

          /*
           * Preserve existing expired
           * subscription cleanup.
           */
          if (
            statusCode === 404 ||
            statusCode === 410
          ) {
            try {
              await prisma
                .webPushSubscription
                .update({
                  where: {
                    id:
                      subscription.id,
                  },

                  data: {
                    isActive:
                      false,
                  },
                });
            } catch (
              subscriptionUpdateError
            ) {
              console.error(
                "[BIRTHDAY_CRON_PUSH_SUBSCRIPTION_UPDATE_FAILED]",
                {
                  leagueId:
                    leagueGroup.leagueId,

                  subscriptionId:
                    subscription.id,

                  error:
                    getErrorMessage(
                      subscriptionUpdateError
                    ),
                }
              );
            }
          }
        }
      }

      /*
       * 9. Independent WhatsApp processing.
       *
       * This runs after Web Push.
       * Any WhatsApp failure is contained.
       */
      const leagueWhatsAppEnabled =
        Boolean(
          leagueGroup
            .whatsappNotificationsEnabled
        );

      const leagueOwnerWhatsAppNumber =
        String(
          leagueGroup
            .ownerWhatsAppNumber ||
            ""
        ).trim();

      const leagueOwnerUserId =
        leagueGroup.ownerId;

      if (
        !leagueWhatsAppEnabled
      ) {
        whatsappSkipped +=
          leagueGroup
            .birthdays
            .length;

        whatsappDeliveryResults.push({
          success: true,
          skipped: true,

          leagueId:
            leagueGroup.leagueId,

          reason:
            "WhatsApp notifications are disabled for this league.",

          birthdayCount:
            leagueGroup
              .birthdays
              .length,
        });

        continue;
      }

      if (
        !leagueOwnerWhatsAppNumber
      ) {
        whatsappSkipped +=
          leagueGroup
            .birthdays
            .length;

        whatsappDeliveryResults.push({
          success: true,
          skipped: true,

          leagueId:
            leagueGroup.leagueId,

          reason:
            "The league owner WhatsApp number is missing.",

          birthdayCount:
            leagueGroup
              .birthdays
              .length,
        });

        continue;
      }

      if (
        !leagueOwnerUserId
      ) {
        whatsappSkipped +=
          leagueGroup
            .birthdays
            .length;

        whatsappDeliveryResults.push({
          success: true,
          skipped: true,

          leagueId:
            leagueGroup.leagueId,

          reason:
            "The league does not have an owner user assigned.",

          birthdayCount:
            leagueGroup
              .birthdays
              .length,
        });

        continue;
      }

      for (
        const birthday
        of leagueGroup.birthdays
      ) {
        let reminderLog = null;

        /*
         * Check for an existing WhatsApp log.
         */
        try {
          reminderLog =
            await prisma
              .birthdayReminderLog
              .findUnique({
                where: {
                  birthdayId_recipientUserId_birthdayYear_reminderType:
                    {
                      birthdayId:
                        birthday.birthdayId,

                      recipientUserId:
                        leagueOwnerUserId,

                      birthdayYear:
                        today.year,

                      reminderType:
                        "WHATSAPP",
                    },
                },
              });
        } catch (lookupError) {
          whatsappFailed += 1;

          const lookupErrorMessage =
            getErrorMessage(
              lookupError
            );

          whatsappDeliveryResults.push({
            success: false,
            skipped: false,

            leagueId:
              leagueGroup.leagueId,

            birthdayId:
              birthday.birthdayId,

            playerName:
              birthday.playerName,

            error:
              `Unable to check WhatsApp reminder history: ${lookupErrorMessage}`,
          });

          console.error(
            "[BIRTHDAY_CRON_WHATSAPP_LOG_LOOKUP_FAILED]",
            {
              leagueId:
                leagueGroup.leagueId,

              birthdayId:
                birthday.birthdayId,

              playerName:
                birthday.playerName,

              error:
                lookupErrorMessage,
            }
          );

          /*
           * Do not risk sending a duplicate
           * when log lookup fails.
           */
          continue;
        }

        /*
         * Never resend an already successful
         * reminder in the same birthday year.
         */
        if (
          reminderLog?.status ===
          "SENT"
        ) {
          whatsappSkipped += 1;

          whatsappDeliveryResults.push({
            success: true,
            skipped: true,

            leagueId:
              leagueGroup.leagueId,

            birthdayId:
              birthday.birthdayId,

            playerName:
              birthday.playerName,

            reminderLogId:
              reminderLog.id,

            reason:
              "This WhatsApp birthday reminder was already sent for this year.",
          });

          continue;
        }

        /*
         * Create a new PENDING log or reset
         * an existing FAILED/PENDING log.
         */
        try {
          if (reminderLog) {
            reminderLog =
              await prisma
                .birthdayReminderLog
                .update({
                  where: {
                    id:
                      reminderLog.id,
                  },

                  data: {
                    status:
                      "PENDING",

                    recipientPhone:
                      leagueOwnerWhatsAppNumber,

                    notificationTitle:
                      `Birthday wish for ${birthday.playerName}`,

                    notificationBody:
                      `Birthday wish for ${birthday.playerName} from ${leagueGroup.leagueName}.`,

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
          } else {
            reminderLog =
              await prisma
                .birthdayReminderLog
                .create({
                  data: {
                    birthdayId:
                      birthday.birthdayId,

                    leagueId:
                      leagueGroup.leagueId,

                    recipientUserId:
                      leagueOwnerUserId,

                    birthdayYear:
                      today.year,

                    reminderType:
                      "WHATSAPP",

                    status:
                      "PENDING",

                    recipientPhone:
                      leagueOwnerWhatsAppNumber,

                    notificationTitle:
                      `Birthday wish for ${birthday.playerName}`,

                    notificationBody:
                      `Birthday wish for ${birthday.playerName} from ${leagueGroup.leagueName}.`,
                  },
                });
          }
        } catch (
          logPreparationError
        ) {
          /*
           * A simultaneous cron may create
           * the same unique log first.
           */
          if (
            logPreparationError?.code ===
            "P2002"
          ) {
            whatsappSkipped += 1;

            whatsappDeliveryResults.push({
              success: true,
              skipped: true,

              leagueId:
                leagueGroup.leagueId,

              birthdayId:
                birthday.birthdayId,

              playerName:
                birthday.playerName,

              reason:
                "Another cron execution already reserved this WhatsApp reminder.",
            });

            continue;
          }

          whatsappFailed += 1;

          const preparationErrorMessage =
            getErrorMessage(
              logPreparationError
            );

          whatsappDeliveryResults.push({
            success: false,
            skipped: false,

            leagueId:
              leagueGroup.leagueId,

            birthdayId:
              birthday.birthdayId,

            playerName:
              birthday.playerName,

            error:
              `Unable to prepare WhatsApp reminder log: ${preparationErrorMessage}`,
          });

          console.error(
            "[BIRTHDAY_CRON_WHATSAPP_LOG_PREPARATION_FAILED]",
            {
              leagueId:
                leagueGroup.leagueId,

              birthdayId:
                birthday.birthdayId,

              playerName:
                birthday.playerName,

              error:
                preparationErrorMessage,
            }
          );

          continue;
        }

        whatsappAttempted += 1;

        try {
          const whatsappResult =
            await sendTwilioWhatsAppBirthdayMessage({
              recipientPhone:
                leagueOwnerWhatsAppNumber,

              playerName:
                birthday.playerName,

              leagueName:
                leagueGroup.leagueName,
            });

          await prisma
            .birthdayReminderLog
            .update({
              where: {
                id:
                  reminderLog.id,
              },

              data: {
                status:
                  "SENT",

                sentAt:
                  new Date(),

                recipientPhone:
                  leagueOwnerWhatsAppNumber,

                providerMessageId:
                  whatsappResult
                    .messageSid,

                providerStatus:
                  whatsappResult.status ||
                  "queued",

                errorMessage:
                  null,
              },
            });

          whatsappSent += 1;

          whatsappDeliveryResults.push({
            success: true,
            skipped: false,

            leagueId:
              leagueGroup.leagueId,

            birthdayId:
              birthday.birthdayId,

            playerName:
              birthday.playerName,

            reminderLogId:
              reminderLog.id,

            messageSid:
              whatsappResult
                .messageSid,

            status:
              whatsappResult.status,

            recipient:
              whatsappResult.recipient,
          });

          console.log(
            "[BIRTHDAY_CRON_WHATSAPP_SUCCESS]",
            {
              leagueId:
                leagueGroup.leagueId,

              birthdayId:
                birthday.birthdayId,

              playerName:
                birthday.playerName,

              reminderLogId:
                reminderLog.id,

              messageSid:
                whatsappResult
                  .messageSid,

              status:
                whatsappResult.status,
            }
          );
        } catch (whatsappError) {
          whatsappFailed += 1;

          const whatsappErrorMessage =
            getErrorMessage(
              whatsappError
            );

          /*
           * Mark as FAILED so the cron
           * can retry it later.
           */
          if (
            reminderLog?.id
          ) {
            await prisma
              .birthdayReminderLog
              .update({
                where: {
                  id:
                    reminderLog.id,
                },

                data: {
                  status:
                    "FAILED",

                  recipientPhone:
                    leagueOwnerWhatsAppNumber,

                  errorMessage:
                    whatsappErrorMessage
                      .slice(
                        0,
                        1000
                      ),

                  providerStatus:
                    "failed",
                },
              })
              .catch(
                (
                  logUpdateError
                ) => {
                  console.error(
                    "[BIRTHDAY_CRON_WHATSAPP_LOG_UPDATE_FAILED]",
                    {
                      reminderLogId:
                        reminderLog.id,

                      error:
                        getErrorMessage(
                          logUpdateError
                        ),
                    }
                  );
                }
              );
          }

          whatsappDeliveryResults.push({
            success: false,
            skipped: false,

            leagueId:
              leagueGroup.leagueId,

            birthdayId:
              birthday.birthdayId,

            playerName:
              birthday.playerName,

            reminderLogId:
              reminderLog?.id ??
              null,

            error:
              whatsappErrorMessage,
          });

          console.error(
            "[BIRTHDAY_CRON_WHATSAPP_FAILED]",
            {
              leagueId:
                leagueGroup.leagueId,

              birthdayId:
                birthday.birthdayId,

              playerName:
                birthday.playerName,

              reminderLogId:
                reminderLog?.id ??
                null,

              error:
                whatsappErrorMessage,
            }
          );

          /*
           * Do not throw.
           * Continue with remaining birthdays.
           */
        }
      }
    }

    const completedAt =
      new Date();

    console.log(
      "[BIRTHDAY_CRON_COMPLETE]",
      {
        startedAt:
          startedAt.toISOString(),

        completedAt:
          completedAt.toISOString(),

        date:
          sentDate,

        birthdaysFound:
          birthdays.length,

        leaguesProcessed:
          leagueGroups.length,

        notificationsAttempted,
        notificationsSent,
        notificationsFailed,

        whatsappAttempted,
        whatsappSent,
        whatsappFailed,
        whatsappSkipped,
      }
    );

    return NextResponse.json({
      /*
       * Preserve Web Push success separately
       * from WhatsApp success.
       */
      success:
        notificationsFailed === 0,

      whatsappSuccess:
        whatsappFailed === 0,

      date:
        sentDate,

      timeZone,

      startedAt:
        startedAt.toISOString(),

      completedAt:
        completedAt.toISOString(),

      birthdaysFound:
        birthdays.length,

      leaguesProcessed:
        leagueGroups.length,

      leagueRecipientCount:
        leagueRecipients.length,

      activeSubscriptionCount:
        subscriptions.length,

      notificationsAttempted,
      notificationsSent,
      notificationsFailed,

      whatsappAttempted,
      whatsappSent,
      whatsappFailed,
      whatsappSkipped,

      message:
        notificationsSent > 0 ||
        whatsappSent > 0
          ? "Birthday notifications processed."
          : "Birthdays were found, but no notifications were delivered.",

      leagues:
        leagueGroups.map(
          (group) => ({
            leagueId:
              group.leagueId,

            leagueName:
              group.leagueName,

            birthdayCount:
              group.birthdays.length,

            whatsappEnabled:
              group
                .whatsappNotificationsEnabled,

            hasOwnerWhatsAppNumber:
              Boolean(
                group
                  .ownerWhatsAppNumber
              ),

            birthdays:
              group.birthdays,
          })
        ),

      deliveryResults,
      whatsappDeliveryResults,
    });
  } catch (error) {
    const errorMessage =
      getErrorMessage(error);

    console.error(
      "[BIRTHDAY_CRON_FATAL_ERROR]",
      {
        error:
          errorMessage,
      }
    );

    return NextResponse.json(
      {
        success: false,
        error:
          errorMessage,
      },
      {
        status: 500,
      }
    );
  }
}