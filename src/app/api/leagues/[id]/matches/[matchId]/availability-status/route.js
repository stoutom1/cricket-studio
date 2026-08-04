import {
  getServerSession,
} from "next-auth";
import {
  NextResponse,
} from "next/server";

import {
  authOptions,
} from "@/lib/auth";
import prisma from "@/lib/prisma";

export const runtime =
  "nodejs";
export const dynamic =
  "force-dynamic";

function cleanNote(value) {
  const note =
    String(value || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 300);

  return note || null;
}

export async function PATCH(
  request,
  {
    params,
  }
) {
  try {
    const session =
      await getServerSession(
        authOptions
      );

    if (
      !session?.user?.email
    ) {
      return NextResponse.json(
        {
          error:
            "Unauthorized.",
        },
        {
          status: 401,
        }
      );
    }

    const {
      id,
      matchId,
    } = await params;

    const leagueId =
      Number(id);

    const numericMatchId =
      Number(matchId);

    if (
      !Number.isInteger(
        leagueId
      ) ||
      leagueId <= 0 ||
      !Number.isInteger(
        numericMatchId
      ) ||
      numericMatchId <= 0
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid league or match ID.",
        },
        {
          status: 400,
        }
      );
    }

    const user =
      await prisma.user
        .findUnique({
          where: {
            email:
              String(
                session.user
                  .email
              )
                .trim()
                .toLowerCase(),
          },

          select: {
            id: true,
          },
        });

    if (!user) {
      return NextResponse.json(
        {
          error:
            "User not found.",
        },
        {
          status: 404,
        }
      );
    }

    const league =
      await prisma.league
        .findUnique({
          where: {
            id:
              leagueId,
          },

          select: {
            ownerId: true,
          },
        });

    if (!league) {
      return NextResponse.json(
        {
          error:
            "League not found.",
        },
        {
          status: 404,
        }
      );
    }

    const isOwner =
      league.ownerId ===
      user.id;

    const member =
      isOwner
        ? null
        : await prisma
            .leagueMember
            .findFirst({
              where: {
                leagueId,
                userId:
                  user.id,
              },

              select: {
                canEditMatch:
                  true,
                canCreateMatch:
                  true,
                canManagePermissions:
                  true,
              },
            });

    const canManageMatchDay =
      isOwner ||
      member
        ?.canEditMatch ===
        true ||
      member
        ?.canCreateMatch ===
        true ||
      member
        ?.canManagePermissions ===
        true;

    if (!canManageMatchDay) {
      return NextResponse.json(
        {
          error:
            "You do not have permission to update match-day readiness.",
        },
        {
          status: 403,
        }
      );
    }

    const match =
      await prisma.match
        .findFirst({
          where: {
            id:
              numericMatchId,
            leagueId,
          },

          select: {
            id: true,
          },
        });

    if (!match) {
      return NextResponse.json(
        {
          error:
            "Match not found.",
        },
        {
          status: 404,
        }
      );
    }

    const body =
      await request.json();

    const availabilityComplete =
      body
        ?.availabilityComplete ===
      true;

    const status =
      await prisma
        .matchDayManualStatus
        .upsert({
          where: {
            matchId:
              numericMatchId,
          },

          update: {
            leagueId,
            availabilityComplete,
            availabilityNote:
              availabilityComplete
                ? cleanNote(
                    body
                      ?.availabilityNote
                  )
                : null,

            completedByUserId:
              availabilityComplete
                ? user.id
                : null,
          },

          create: {
            leagueId,
            matchId:
              numericMatchId,

            availabilityComplete,

            availabilityNote:
              availabilityComplete
                ? cleanNote(
                    body
                      ?.availabilityNote
                  )
                : null,

            completedByUserId:
              availabilityComplete
                ? user.id
                : null,
          },
        });

    return NextResponse.json({
      success: true,

      status: {
        matchId:
          status.matchId,

        availabilityComplete:
          status
            .availabilityComplete,

        availabilityNote:
          status
            .availabilityNote,

        updatedAt:
          status.updatedAt,
      },
    });
  } catch (error) {
    console.error(
      "[MATCH_DAY_AVAILABILITY_STATUS_FAILED]",
      error
    );

    return NextResponse.json(
      {
        success: false,

        error:
          error instanceof Error
            ? error.message
            : "Unable to update availability readiness.",
      },
      {
        status: 500,
      }
    );
  }
}
