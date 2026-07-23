import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { sendWebPushNotification } from "@/lib/web-push";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const session = await getServerSession(
      authOptions
    );

    if (!session?.user?.email) {
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

    let body;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid request body.",
        },
        {
          status: 400,
        }
      );
    }

    const leagueId = Number(body?.leagueId);

    if (
      !Number.isInteger(leagueId) ||
      leagueId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "A valid leagueId is required.",
        },
        {
          status: 400,
        }
      );
    }

    const user = await prisma.user.findUnique({
      where: {
        email: session.user.email,
      },

      select: {
        id: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: "User account was not found.",
        },
        {
          status: 404,
        }
      );
    }

    /*
     * Optional but recommended:
     * confirm that this user has access to the league.
     *
     * Adjust this query to match your actual Prisma
     * league-membership model.
     */
    const league = await prisma.league.findUnique({
      where: {
        id: leagueId,
      },

      select: {
        id: true,
        name: true,
      },
    });

    if (!league) {
      return NextResponse.json(
        {
          success: false,
          error: "League was not found.",
        },
        {
          status: 404,
        }
      );
    }

const subscriptions =
  await prisma.webPushSubscription.findMany({
    where: {
      userId: user.id,
      isActive: true,
    },

    select: {
      id: true,
      endpoint: true,
      p256dh: true,
      auth: true,
    },
  });

    if (subscriptions.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            "No active notification subscriptions were found.",
          attemptedCount: 0,
          sentCount: 0,
          failedCount: 0,
          results: [],
        },
        {
          status: 404,
        }
      );
    }

    const payload = {
      title: "Cric4All Birthday Alert",

      body:
        `Test notification for ${league.name}. Tap to view today's birthdays.`,

      url:
        `/leagues/${leagueId}/birthdays/today`,

      type: "BIRTHDAY_ALERT",
      leagueId,
    };

    const results = [];

    for (const subscription of subscriptions) {
      try {
        const sendResult =
  await sendWebPushNotification({
    subscription,
    payload,
  });

        results.push({
          subscriptionId: subscription.id,
          success: true,
          statusCode:
            sendResult?.statusCode ?? 201,
        });

        await prisma.webPushSubscription.update({
          where: {
            id: subscription.id,
          },

          data: {
            lastUsedAt: new Date(),
          },
        });
      } catch (error) {
        console.error(
          `Push failed for subscription ${subscription.id}:`,
          error
        );

        const statusCode =
          error?.statusCode ?? null;

        results.push({
          subscriptionId: subscription.id,
          success: false,
          statusCode,
          error:
            error instanceof Error
              ? error.message
              : "Push delivery failed.",
        });

        /*
         * Remove expired subscriptions.
         */
        if (
          statusCode === 404 ||
          statusCode === 410
        ) {
          await prisma.webPushSubscription.update({
            where: {
              id: subscription.id,
            },

            data: {
              isActive: false,
            },
          });
        }
      }
    }

    const sentCount = results.filter(
      (result) => result.success
    ).length;

    const failedCount =
      results.length - sentCount;

    return NextResponse.json(
      {
        success: sentCount > 0,
        attemptedCount: results.length,
        sentCount,
        failedCount,
        results,
      },
      {
        status: sentCount > 0 ? 200 : 500,
      }
    );
  } catch (error) {
    console.error(
      "Test push route failed:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to send the test notification.",
      },
      {
        status: 500,
      }
    );
  }
}