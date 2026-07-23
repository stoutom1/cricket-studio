import { NextResponse } from "next/server";

import prisma from "@/lib/prisma";
import {
  sendWebPushNotification,
} from "@/lib/web-push";

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

  const values = Object.fromEntries(
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
        birthdays: [],
      });
    }

    grouped.get(leagueId).birthdays.push({
      birthdayId: birthday.id,

      playerId:
        birthday.player?.id ?? null,

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
      await prisma.leagueBirthday.findMany({
        where: {
          isActive: true,
          birthMonth: today.month,
          birthDay: today.day,
        },

        select: {
          id: true,
          name: true,

          league: {
            select: {
              id: true,
              name: true,
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
        count: birthdays.length,
        birthdays: birthdays.map(
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
    if (birthdays.length === 0) {
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
        message:
          "No active birthdays were found today.",
      });
    }

    /*
     * 5. Group birthdays by league.
     *
     * Each notification must open a specific:
     *
     * /leagues/{leagueId}/birthdays/today
     */
    const leagueGroups =
      groupBirthdaysByLeague(
        birthdays
      );

    const leagueIds =
      leagueGroups.map(
        (group) => group.leagueId
      );

    /*
     * 6. Find users who enabled birthday
     * notifications for these leagues.
     */
    /*
 * Find the owner/admin recipients for each league.
 *
 * IMPORTANT:
 * Adjust the relation/model names below to match
 * your exact Prisma schema.
 */
const leagueRecipients =
  await prisma.leagueMember.findMany({
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
      (recipient) => recipient.userId
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

if (recipientUserIds.length === 0) {
  return NextResponse.json({
    success: true,
    date: sentDate,
    timeZone,

    birthdaysFound:
      birthdays.length,

    leaguesProcessed:
      leagueGroups.length,

    notificationsAttempted: 0,
    notificationsSent: 0,
    notificationsFailed: 0,

    message:
      "Birthdays were found, but no league owners were found.",
  });
}

    /*
     * 7. Load active Web Push subscriptions.
     */
    const subscriptions =
      await prisma.webPushSubscription.findMany({
        where: {
          userId: {
            in: recipientUserIds,
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
      });

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

    const deliveryResults = [];

    /*
     * 8. Send one notification per league
     * to every subscribed eligible user.
     */
    for (const leagueGroup of leagueGroups) {
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
        leagueGroup.birthdays.length;

      const payload = {
        title:
          birthdayCount === 1
            ? `🎂 Birthday today in ${leagueGroup.leagueName}`
            : `🎂 ${birthdayCount} birthdays today in ${leagueGroup.leagueName}`,

        body: createNotificationBody(
          leagueGroup.birthdays
        ),

        icon: "/icons/icon-192x192.png",
        badge: "/icons/icon-96x96.png",

        tag:
          `birthday-${leagueGroup.leagueId}-${sentDate}`,

        renotify: false,

        url:
          `/leagues/${leagueGroup.leagueId}/birthdays/today`,

        data: {
          type: "LEAGUE_BIRTHDAY",
          leagueId:
            leagueGroup.leagueId,
          date: sentDate,
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

      for (
        const subscription
        of leagueSubscriptions
      ) {
        notificationsAttempted += 1;

        try {
          /*
           * Important:
           *
           * This matches the helper signature used
           * by the working test notification route.
           */
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
           * Optional: update last successful use.
           *
           * Remove this update if your model does not
           * contain lastUsedAt.
           */
          await prisma
            .webPushSubscription
            .update({
              where: {
                id: subscription.id,
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
            error: errorMessage,
          });

          console.error(
            "[BIRTHDAY_CRON_PUSH_FAILED]",
            {
              leagueId:
                leagueGroup.leagueId,
              subscriptionId:
                subscription.id,
              statusCode,
              error: errorMessage,
            }
          );

          /*
           * The browser push subscription no longer
           * exists. Disable it in the database.
           */
          if (
            statusCode === 404 ||
            statusCode === 410
          ) {
            await prisma
              .webPushSubscription
              .update({
                where: {
                  id:
                    subscription.id,
                },

                data: {
                  isActive: false,
                },
              });
          }
        }
      }
    }

    const completedAt = new Date();

    console.log(
      "[BIRTHDAY_CRON_COMPLETE]",
      {
        startedAt:
          startedAt.toISOString(),
        completedAt:
          completedAt.toISOString(),
        date: sentDate,
        birthdaysFound:
          birthdays.length,
        leaguesProcessed:
          leagueGroups.length,
        notificationsAttempted,
        notificationsSent,
        notificationsFailed,
      }
    );

    return NextResponse.json({
      success:
        notificationsFailed === 0,

      date: sentDate,
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

      message:
        notificationsSent > 0
          ? "Birthday push notifications sent."
          : "Birthdays were found, but no push notifications were delivered.",

      leagues: leagueGroups.map(
        (group) => ({
          leagueId:
            group.leagueId,
          leagueName:
            group.leagueName,
          birthdayCount:
            group.birthdays.length,
          birthdays:
            group.birthdays,
        })
      ),

      deliveryResults,
    });
  } catch (error) {
    const errorMessage =
      getErrorMessage(error);

    console.error(
      "[BIRTHDAY_CRON_FATAL_ERROR]",
      {
        error: errorMessage,
      }
    );

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      {
        status: 500,
      }
    );
  }
}