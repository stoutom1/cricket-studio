import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getClientIp(request) {
  const forwardedFor =
    request.headers.get("x-forwarded-for");

  if (forwardedFor) {
    return forwardedFor
      .split(",")[0]
      .trim()
      .slice(0, 100);
  }

  return (
    request.headers
      .get("x-real-ip")
      ?.trim()
      .slice(0, 100) ||
    null
  );
}

function getUserAgent(request) {
  return (
    request.headers
      .get("user-agent")
      ?.trim()
      .slice(0, 500) ||
    null
  );
}

function parsePositiveInteger(value) {
  const parsed = Number(value);

  return Number.isInteger(parsed) &&
    parsed > 0
    ? parsed
    : null;
}

export async function POST(request) {
  try {
    const session =
      await getServerSession(
        authOptions
      );

    if (!session?.user?.id) {
      return NextResponse.json(
        {
          error:
            "You must be signed in.",
        },
        {
          status: 401,
        }
      );
    }

    const body =
      await request.json();

    const playerId =
      parsePositiveInteger(
        body.playerId
      );

    const birthdayId =
      parsePositiveInteger(
        body.birthdayId
      );

    const optedIn =
      body.optedIn === true;

    if (!playerId && !birthdayId) {
      return NextResponse.json(
        {
          error:
            "playerId or birthdayId is required.",
        },
        {
          status: 400,
        }
      );
    }

    const now =
      new Date();

    const source =
      String(
        body.source ||
          "SMS_OPT_IN_PAGE"
      )
        .trim()
        .slice(0, 100);

    const ipAddress =
      getClientIp(request);

    const userAgent =
      getUserAgent(request);

    /*
     * Explicit opt-in and explicit opt-out
     * are recorded separately.
     */
    const consentData = optedIn
      ? {
          smsOptIn:
            true,

          smsOptInAt:
            now,

          smsOptOutAt:
            null,

          smsOptInSource:
            source,

          smsOptInIpAddress:
            ipAddress,

          smsOptInUserAgent:
            userAgent,
        }
      : {
          smsOptIn:
            false,

          smsOptOutAt:
            now,

          smsOptInSource:
            source,

          smsOptInIpAddress:
            ipAddress,

          smsOptInUserAgent:
            userAgent,
        };

    let updatedPlayer =
      null;

    let updatedBirthday =
      null;

    if (playerId) {
      const player =
        await prisma.player.findUnique({
          where: {
            id:
              playerId,
          },

          select: {
            id:
              true,

            name:
              true,
          },
        });

      if (!player) {
        return NextResponse.json(
          {
            error:
              "Player not found.",
          },
          {
            status: 404,
          }
        );
      }

      updatedPlayer =
        await prisma.player.update({
          where: {
            id:
              playerId,
          },

          data:
            consentData,

          select: {
            id:
              true,

            name:
              true,

            smsOptIn:
              true,

            smsOptInAt:
              true,

            smsOptOutAt:
              true,

            smsOptInSource:
              true,
          },
        });
    }

    if (birthdayId) {
      const birthday =
        await prisma.leagueBirthday
          .findUnique({
            where: {
              id:
                birthdayId,
            },

            select: {
              id:
                true,

              name:
                true,

              playerId:
                true,
            },
          });

      if (!birthday) {
        return NextResponse.json(
          {
            error:
              "Birthday record not found.",
          },
          {
            status: 404,
          }
        );
      }

      updatedBirthday =
        await prisma.leagueBirthday
          .update({
            where: {
              id:
                birthdayId,
            },

            data:
              consentData,

            select: {
              id:
                true,

              name:
                true,

              playerId:
                true,

              smsOptIn:
                true,

              smsOptInAt:
                true,

              smsOptOutAt:
                true,

              smsOptInSource:
                true,
            },
          });

      /*
       * Keep the linked player in sync when one exists.
       */
      if (
        birthday.playerId &&
        !playerId
      ) {
        updatedPlayer =
          await prisma.player.update({
            where: {
              id:
                birthday.playerId,
            },

            data:
              consentData,

            select: {
              id:
                true,

              name:
                true,

              smsOptIn:
                true,

              smsOptInAt:
                true,

              smsOptOutAt:
                true,

              smsOptInSource:
                true,
            },
          });
      }
    }

    console.log(
      "[BIRTHDAY_SMS_CONSENT_UPDATED]",
      {
        userId:
          session.user.id,

        playerId:
          updatedPlayer?.id ||
          playerId ||
          null,

        birthdayId:
          updatedBirthday?.id ||
          birthdayId ||
          null,

        optedIn,

        source,
      }
    );

    return NextResponse.json({
      success:
        true,

      optedIn,

      player:
        updatedPlayer,

      birthday:
        updatedBirthday,
    });
  } catch (error) {
    const errorMessage =
      String(
        error instanceof Error
          ? error.message
          : error
      ).slice(0, 1000);

    console.error(
      "[BIRTHDAY_SMS_CONSENT_UPDATE_FAILED]",
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
          "Unable to update SMS preference.",

        details:
          errorMessage,
      },
      {
        status: 500,
      }
    );
  }
}