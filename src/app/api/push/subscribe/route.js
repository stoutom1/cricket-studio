import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getDeviceName(userAgent) {
  const value = String(
    userAgent || ""
  ).toLowerCase();

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

function getValidExpirationTime(
  expirationTime
) {
  if (
    expirationTime === null ||
    expirationTime === undefined ||
    expirationTime === ""
  ) {
    return null;
  }

  const numericExpirationTime =
    Number(expirationTime);

  if (
    !Number.isFinite(
      numericExpirationTime
    ) ||
    numericExpirationTime < 0
  ) {
    return null;
  }

  return BigInt(
    Math.trunc(
      numericExpirationTime
    )
  );
}

function getValidReminderHour(value) {
  const reminderHour =
    Number(value);

  if (
    Number.isInteger(reminderHour) &&
    reminderHour >= 0 &&
    reminderHour <= 23
  ) {
    return reminderHour;
  }

  return 8;
}

function getValidTimeZone(value) {
  const timeZone =
    String(
      value ||
        "America/Los_Angeles"
    ).trim();

  try {
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone,
      }
    ).format();

    return timeZone;
  } catch {
    return "America/Los_Angeles";
  }
}

export async function POST(request) {
  try {
    const session =
      await getServerSession(
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

    const body =
      await request.json();

    const endpoint =
      String(
        body?.subscription
          ?.endpoint || ""
      ).trim();

    const p256dh =
      String(
        body?.subscription
          ?.keys?.p256dh || ""
      ).trim();

    const auth =
      String(
        body?.subscription
          ?.keys?.auth || ""
      ).trim();

    const expirationTime =
      getValidExpirationTime(
        body?.subscription
          ?.expirationTime
      );

    const leagueId =
      Number(body?.leagueId);

    const birthdayPreference =
      body?.birthdayPreference &&
      typeof body.birthdayPreference ===
        "object"
        ? body.birthdayPreference
        : {};

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

    if (
      !Number.isInteger(leagueId) ||
      leagueId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "A valid league ID is required.",
        },
        {
          status: 400,
        }
      );
    }

    const user =
      await prisma.user.findUnique({
        where: {
          email:
            session.user.email,
        },

        select: {
          id: true,
        },
      });

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error:
            "User was not found.",
        },
        {
          status: 404,
        }
      );
    }

    const league =
      await prisma.league.findUnique({
        where: {
          id: leagueId,
        },

        select: {
          id: true,
          ownerId: true,

          members: {
            where: {
              userId: user.id,
            },

            select: {
              id: true,
            },

            take: 1,
          },
        },
      });

    if (!league) {
      return NextResponse.json(
        {
          success: false,
          error:
            "League was not found.",
        },
        {
          status: 404,
        }
      );
    }

    const isLeagueOwner =
      league.ownerId === user.id;

    const isLeagueMember =
      Array.isArray(
        league.members
      ) &&
      league.members.length > 0;

    if (
      !isLeagueOwner &&
      !isLeagueMember
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "You do not have access to this league.",
        },
        {
          status: 403,
        }
      );
    }

    const reminderHour =
      getValidReminderHour(
        birthdayPreference
          ?.reminderHour
      );

    const timeZone =
      getValidTimeZone(
        birthdayPreference
          ?.timeZone
      );

    const enabled =
      birthdayPreference
        ?.enabled !== false;

    const notifyOnBirthday =
      birthdayPreference
        ?.notifyOnBirthday !==
      false;

    const notifyDayBefore =
      birthdayPreference
        ?.notifyDayBefore !==
      false;

    const emailFallbackEnabled =
      birthdayPreference
        ?.emailFallbackEnabled !==
      false;

    const userAgent =
      request.headers.get(
        "user-agent"
      ) || null;

    const result =
      await prisma.$transaction(
        async (transaction) => {
          const savedSubscription =
            await transaction
              .webPushSubscription
              .upsert({
                where: {
                  endpoint,
                },

                update: {
                  userId:
                    user.id,

                  p256dh,
                  auth,
                  expirationTime,

                  userAgent,

                  deviceName:
                    getDeviceName(
                      userAgent
                    ),

                  isActive: true,

                  lastUsedAt:
                    new Date(),
                },

                create: {
                  userId:
                    user.id,

                  endpoint,
                  p256dh,
                  auth,
                  expirationTime,

                  userAgent,

                  deviceName:
                    getDeviceName(
                      userAgent
                    ),

                  isActive: true,

                  lastUsedAt:
                    new Date(),
                },

                select: {
                  id: true,
                  deviceName: true,
                  isActive: true,
                },
              });

          const savedPreference =
            await transaction
              .birthdayNotificationPreference
              .upsert({
                where: {
                  userId_leagueId: {
                    userId:
                      user.id,

                    leagueId,
                  },
                },

                create: {
                  userId:
                    user.id,

                  leagueId,

                  enabled,

                  notifyDayBefore,

                  notifyOnBirthday,

                  reminderHour,

                  timeZone,

                  emailFallbackEnabled,
                },

                update: {
                  enabled,

                  notifyDayBefore,

                  notifyOnBirthday,

                  reminderHour,

                  timeZone,

                  emailFallbackEnabled,
                },

                select: {
                  id: true,
                  userId: true,
                  leagueId: true,
                  enabled: true,

                  notifyDayBefore:
                    true,

                  notifyOnBirthday:
                    true,

                  reminderHour:
                    true,

                  timeZone:
                    true,

                  emailFallbackEnabled:
                    true,
                },
              });

          return {
            savedSubscription,
            savedPreference,
          };
        }
      );

    return NextResponse.json({
      success: true,

      message:
        "Birthday notifications were enabled successfully.",

      subscription:
        result.savedSubscription,

      birthdayPreference:
        result.savedPreference,
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