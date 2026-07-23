import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getDeviceName(userAgent) {
  const value =
    String(userAgent || "").toLowerCase();

  if (
    value.includes("iphone") ||
    value.includes("ipad")
  ) {
    return "Apple mobile device";
  }

  if (value.includes("android")) {
    return "Android device";
  }

  if (value.includes("windows")) {
    return "Windows computer";
  }

  if (value.includes("macintosh")) {
    return "Mac computer";
  }

  return "Web browser";
}

export async function POST(request) {
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

    const body = await request.json();

    const endpoint =
      String(
        body?.subscription?.endpoint || ""
      ).trim();

    const p256dh =
      String(
        body?.subscription?.keys?.p256dh ||
          ""
      ).trim();

    const auth =
      String(
        body?.subscription?.keys?.auth ||
          ""
      ).trim();

    const expirationTime =
      body?.subscription?.expirationTime;

    if (!endpoint || !p256dh || !auth) {
      return NextResponse.json(
        {
          success: false,
          error:
            "The push subscription is incomplete.",
        },
        {
          status: 400,
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
        },
      });

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: "User was not found.",
        },
        {
          status: 404,
        }
      );
    }

    const userAgent =
      request.headers.get("user-agent") ||
      null;

    const savedSubscription =
      await prisma.webPushSubscription.upsert({
        where: {
          endpoint,
        },

        update: {
          userId: user.id,
          p256dh,
          auth,

          expirationTime:
            expirationTime === null ||
            expirationTime === undefined
              ? null
              : BigInt(
                  Math.trunc(
                    Number(expirationTime)
                  )
                ),

          userAgent,
          deviceName:
            getDeviceName(userAgent),

          isActive: true,
          lastUsedAt: new Date(),
        },

        create: {
          userId: user.id,
          endpoint,
          p256dh,
          auth,

          expirationTime:
            expirationTime === null ||
            expirationTime === undefined
              ? null
              : BigInt(
                  Math.trunc(
                    Number(expirationTime)
                  )
                ),

          userAgent,
          deviceName:
            getDeviceName(userAgent),

          isActive: true,
          lastUsedAt: new Date(),
        },

        select: {
          id: true,
          deviceName: true,
          isActive: true,
        },
      });

    return NextResponse.json({
      success: true,
      subscription:
        savedSubscription,
    });
  } catch (error) {
    console.error(
      "Saving push subscription failed:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to save subscription.",
      },
      {
        status: 500,
      }
    );
  }
}