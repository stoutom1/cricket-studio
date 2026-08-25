import { NextResponse } from "next/server";

import prisma from "@/lib/prisma";
import {
  PLAYER_INACTIVITY_DAYS,
  findInactivePlayerIdentities,
} from "@/lib/player-inactivity-alerts";
import {
  requirePlayerInactivityAlertManager,
} from "@/lib/player-inactivity-alert-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request,
  { params }
) {
  try {
    const { id } =
      await params;

    const leagueId =
      Number(
        id
      );

    if (
      !Number.isInteger(
        leagueId
      ) ||
      leagueId <= 0
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid league ID.",
        },
        {
          status:
            400,
        }
      );
    }

    const access =
      await requirePlayerInactivityAlertManager(
        leagueId
      );

    if (!access.allowed) {
      return NextResponse.json(
        {
          error:
            access.error,
        },
        {
          status:
            access.status,
        }
      );
    }

    const league =
      await prisma.league.findUnique({
        where: {
          id:
            leagueId,
        },
        select: {
          id:
            true,
          name:
            true,
          slug:
            true,
          teams: {
            select: {
              id:
                true,
              name:
                true,
              players: {
                select: {
                  id:
                    true,
                  name:
                    true,
                  teamId:
                    true,
                  createdAt:
                    true,
                },
              },
            },
          },
          matches: {
            where: {
              status: {
                in: [
                  "COMPLETED",
                  "COMPLETED_LOCKED",
                  "COMPLETED_CORRECTED",
                  "ABANDONED",
                ],
              },
            },
            select: {
              id:
                true,
              status:
                true,
              teamAId:
                true,
              teamBId:
                true,
              endedAt:
                true,
              startedAt:
                true,
              scheduledAt:
                true,
              createdAt:
                true,
              teamACaptainId:
                true,
              teamBCaptainId:
                true,
              teamAViceCaptainId:
                true,
              teamBViceCaptainId:
                true,
              teamAWicketKeeperId:
                true,
              teamBWicketKeeperId:
                true,
              balls: {
                select: {
                  strikerId:
                    true,
                  nonStrikerId:
                    true,
                  bowlerId:
                    true,
                  dismissedPlayerId:
                    true,
                  newBatterId:
                    true,
                  fielderId:
                    true,
                },
              },
            },
          },
        },
      });

    if (!league) {
      return NextResponse.json(
        {
          error:
            "League not found.",
        },
        {
          status:
            404,
        }
      );
    }

    const inactive =
      await findInactivePlayerIdentities({
        league,
        inactivityDays:
          PLAYER_INACTIVITY_DAYS,
      });

    return NextResponse.json({
      success:
        true,
      inactivityDays:
        PLAYER_INACTIVITY_DAYS,
      count:
        inactive.length,
      players:
        inactive.map(
          (player) => ({
            identityKey:
              player.identityKey,
            playerName:
              player.playerName,
            playerIds:
              player.playerIds,
            lastPlayedAt:
              player.lastPlayedAt,
            activityAnchorAt:
              player.activityAnchorAt,
            eligibleAt:
              player.eligibleAt,
          })
        ),
    });
  } catch (error) {
    console.error(
      "[PLAYER_INACTIVITY_PREVIEW_FAILED]",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to preview inactive players.",
      },
      {
        status:
          500,
      }
    );
  }
}
