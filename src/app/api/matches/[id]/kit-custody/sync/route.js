import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import {
  syncKitCustodyTasksForMatch,
} from "@/lib/kit/team-custody";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COMPLETED_MATCH_STATUSES =
  new Set([
    "COMPLETED",
    "COMPLETED_LOCKED",
    "COMPLETED_CORRECTED",
  ]);

function positiveId(value) {
  const id =
    Number(value);

  return Number.isInteger(id) &&
    id > 0
    ? id
    : null;
}

function normalizeStatus(value) {
  return String(value || "")
    .trim()
    .toUpperCase();
}

function matchLabel(match) {
  return `${
    match?.teamA?.name ||
    "Team A"
  } vs ${
    match?.teamB?.name ||
    "Team B"
  }`;
}

/*
 * POST /api/matches/[id]/kit-custody/sync
 *
 * Purpose:
 * The normal scoring API can complete a match directly on the last delivery.
 * That path does not pass through /api/matches/[id]/end, so the existing
 * post-match Team Kit task creation/popup was skipped.
 *
 * This endpoint is intentionally narrow:
 * - It does NOT complete/end/lock/abandon a match.
 * - It does NOT edit score or result text.
 * - It does NOT require a next scheduled match.
 * - It only synchronizes pending custody tasks for an ALREADY completed match.
 */
export async function POST(
  request,
  { params }
) {
  try {
    const session =
      await getServerSession(
        authOptions
      );

    if (!session?.user) {
      return NextResponse.json(
        {
          error:
            "Unauthorized",
        },
        {
          status:
            401,
        }
      );
    }

    const { id } =
      await params;

    const matchId =
      positiveId(id);

    if (!matchId) {
      return NextResponse.json(
        {
          error:
            "Invalid match id.",
        },
        {
          status:
            400,
        }
      );
    }

    const match =
      await prisma.match
        .findUnique({
          where: {
            id:
              matchId,
          },

          include: {
            teamA:
              true,

            teamB:
              true,

            league:
              true,

            series:
              true,
          },
        });

    if (!match) {
      return NextResponse.json(
        {
          error:
            "Match not found.",
        },
        {
          status:
            404,
        }
      );
    }

    const status =
      normalizeStatus(
        match.status
      );

    if (
      !COMPLETED_MATCH_STATUSES
        .has(status)
    ) {
      return NextResponse.json(
        {
          error:
            "Kit custody can be synchronized only after the match is completed.",
        },
        {
          status:
            409,
        }
      );
    }

    let kitCustody = {
      required:
        true,

      created:
        0,

      pendingTaskCount:
        0,

      warning:
        "",
    };

    try {
      const syncResult =
        await syncKitCustodyTasksForMatch(
          match
        );

      const pendingTaskRows =
        await prisma.$queryRaw`
          SELECT
            COUNT(*)::INTEGER AS "count"
          FROM "TeamKitCustodyTask"
          WHERE "matchId" = ${matchId}
            AND "status" = 'PENDING'
        `;

      kitCustody = {
        required:
          true,

        created:
          Number(
            syncResult
              ?.created ||
            0
          ),

        pendingTaskCount:
          Number(
            pendingTaskRows
              ?.[0]
              ?.count ||
            0
          ),

        skippedBeforeTrackingStart:
          Boolean(
            syncResult
              ?.skippedBeforeTrackingStart
          ),

        warning:
          "",
      };

      if (
        kitCustody
          .pendingTaskCount ===
          0 &&
        !kitCustody
          .skippedBeforeTrackingStart
      ) {
        kitCustody.warning =
          "The match is completed, but no pending kit-custody task was found. Open Team Kit to review the custody state.";
      }
    } catch (
      kitTaskError
    ) {
      console.error(
        "[POST_MATCH_KIT_TASK_SYNC_FAILED]",
        kitTaskError
      );

      kitCustody.warning =
        kitTaskError
          ?.message ||
        "Unable to create the kit-custody follow-up.";
    }

    return NextResponse.json({
      success:
        true,

      match: {
        id:
          match.id,

        leagueId:
          match.leagueId,

        status:
          match.status,

        statusText:
          match.statusText,
      },

      kitCustody,

      nextAction: {
        type:
          "RECORD_KIT_CUSTODY",

        leagueId:
          match.leagueId,

        matchId:
          match.id,

        matchLabel:
          matchLabel(match),
      },
    });
  } catch (error) {
    console.error(
      "[POST_MATCH_KIT_SYNC_ROUTE_FAILED]",
      error
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Unable to synchronize post-match kit custody.",
      },
      {
        status:
          500,
      }
    );
  }
}
