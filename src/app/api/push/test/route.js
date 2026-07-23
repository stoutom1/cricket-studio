import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

import {
  sendWebPushNotification,
} from "@/lib/web-push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const session =
      await getServerSession(authOptions);

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

    const user =
      await prisma.user.findUnique({
        where: {
          email: session.user.email,
        },

        select: {
          id: true,

          webPushSubscriptions: {
            where: {
              isActive: true,
            },

            select: {
              id: true,
              endpoint: true,
              p256dh: true,
              auth: true,
              expirationTime: true,
            },
          },
        },
      });

    if (
      !user ||
      user.webPushSubscriptions.length === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "No active notification subscription was found.",
        },
        {
          status: 400,
        }
      );
    }

    const results = [];

    for (
      const subscription
      of user.webPushSubscriptions
    ) {
      const sendResult =
        await sendWebPushNotification({
          subscription,

          payload: {
            title:
              "🏏 Cric4All Test Notification",

            body:
              "Web Push is working. Tap to open today’s birthdays.",

            type: "TEST",

            url:
              "/birthdays/today?source=push-test",

            icon:
              "/icons/icon-192.png",

            badge:
              "/icons/icon-192.png",

            tag:
              "cric4all-push-test",
          },
        });

      /*
       * 404 and 410 normally indicate that the
       * browser subscription is no longer valid.
       */
      if (
        sendResult.statusCode === 404 ||
        sendResult.statusCode === 410
      ) {
        await prisma
          .webPushSubscription
          .update({
            where: {
              id: subscription.id,
            },

            data: {
              isActive: false,
            },
          });
      }

      results.push({
        subscriptionId:
          subscription.id,

        ...sendResult,
      });
    }

    const sentCount =
      results.filter(
        (result) => result.success
      ).length;

    return NextResponse.json({
      success: sentCount > 0,
      attemptedCount:
        results.length,
      sentCount,
      failedCount:
        results.length - sentCount,
      results,
    });
  } catch (error) {
    console.error(
      "Test push failed:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Test push failed.",
      },
      {
        status: 500,
      }
    );
  }
}