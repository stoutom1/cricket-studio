import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { recordGrowthEvent } from "@/lib/growth";
import {
  syncKitCustodyTasksForMatch,
} from "@/lib/kit/team-custody";

export const runtime = "nodejs";

function validMatchId(value) {
  const id = Number(value);

  return Number.isInteger(id) && id > 0
    ? id
    : null;
}

function matchLabel(match) {
  return `${match?.teamA?.name || "Team A"} vs ${
    match?.teamB?.name || "Team B"
  }`;
}

export async function POST(
  request,
  { params }
) {
  try {
    const session =
      await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        {
          error: "Unauthorized",
        },
        {
          status: 401,
        }
      );
    }

    const { id } = await params;
    const matchId = validMatchId(id);

    if (!matchId) {
      return NextResponse.json(
        {
          error: "Invalid match id",
        },
        {
          status: 400,
        }
      );
    }

    const body = await request.json();
    const matchEndType = String(
      body?.matchEndType || "End"
    );

    const beforeMatch =
      await prisma.match.findUnique({
        where: {
          id: matchId,
        },
        include: {
          teamA: true,
          teamB: true,
          league: true,
          series: true,
        },
      });

    if (!beforeMatch) {
      return NextResponse.json(
        {
          error: "Match not found",
        },
        {
          status: 404,
        }
      );
    }

    let status;
    let endedAt = null;
    let lockedAt = null;
    let statusText;
    let auditAction;
    let auditDescription;

    if (matchEndType === "DLS") {
      const requestedStatusText = String(
        body?.statusText || ""
      ).trim();

      if (!requestedStatusText) {
        return NextResponse.json(
          {
            error:
              "A DLS result description is required.",
          },
          {
            status: 400,
          }
        );
      }

      status = "COMPLETED";
      statusText = requestedStatusText;
      endedAt = new Date();
      auditAction = "MATCH_ENDED_DLS";
      auditDescription =
        `Match "${matchLabel(beforeMatch)}" was completed using DLS: ${requestedStatusText}`;
    } else if (matchEndType === "Lock") {
      status = "COMPLETED_LOCKED";
      statusText = "COMPLETED_LOCKED";
      lockedAt = new Date();
      auditAction = "MATCH_LOCKED";
      auditDescription =
        `Match "${matchLabel(beforeMatch)}" was locked.`;
    } else if (
      matchEndType === "Abandon"
    ) {
      status = "ABANDONED";
      statusText = "ABANDONED";
      endedAt = new Date();
      auditAction = "MATCH_ABANDONED";
      auditDescription =
        `Match "${matchLabel(beforeMatch)}" was abandoned.`;
    } else {
      status = "COMPLETED";
      statusText = "MATCH COMPLETED";
      endedAt = new Date();
      auditAction = "MATCH_ENDED";
      auditDescription =
        `Match "${matchLabel(beforeMatch)}" was ended.`;
    }

    const updatedMatch =
      await prisma.match.update({
        where: {
          id: matchId,
        },
        data: {
          status,
          endedAt,
          lockedAt,
          statusText,
        },
        include: {
          teamA: true,
          teamB: true,
          league: true,
          series: true,
        },
      });

    let kitCustody = {
      required: true,
      created: 0,
      pendingTaskCount: 0,
      warning: "",
    };

    try {
      const syncResult =
        await syncKitCustodyTasksForMatch(
          updatedMatch
        );

      const pendingTaskRows =
        await prisma.$queryRaw`
          SELECT COUNT(*)::INTEGER AS "count"
          FROM "TeamKitCustodyTask"
          WHERE "matchId" = ${matchId}
            AND "status" = 'PENDING'
        `;

      kitCustody = {
        required: true,
        created: Number(
          syncResult?.created || 0
        ),
        pendingTaskCount: Number(
          pendingTaskRows?.[0]?.count || 0
        ),
        skippedBeforeTrackingStart:
          Boolean(
            syncResult
              ?.skippedBeforeTrackingStart
          ),
        warning: "",
      };

      if (
        kitCustody.pendingTaskCount === 0 &&
        !kitCustody
          .skippedBeforeTrackingStart
      ) {
        kitCustody.warning =
          "The match ended, but no pending kit-custody task was found. An Owner or league-wide Admin should run the Team Kit repair action.";
      }
    } catch (kitTaskError) {
      console.error(
        "Unable to create team-kit custody task:",
        kitTaskError
      );

      kitCustody.warning =
        kitTaskError?.message ||
        "Unable to create the kit-custody follow-up.";
    }

    if (status === "COMPLETED" && beforeMatch.status !== "COMPLETED" && beforeMatch.status !== "COMPLETED_LOCKED") {
      await recordGrowthEvent({
        eventType: "MATCH_COMPLETED",
        userId: session?.user?.id || null,
        leagueId: updatedMatch.leagueId,
        matchId: updatedMatch.id,
        source: "MATCH_END_API",
        path: "/dashboard",
        metadata: { method: matchEndType },
      });
    }

    await logAudit({
      action: auditAction,
      entityType: "MATCH",
      entityId: matchId,
      leagueId:
        updatedMatch.leagueId || null,
      matchId,
      actor: session.user,
      description: auditDescription,
      beforeData: beforeMatch,
      afterData: updatedMatch,
      request,
    });

    return NextResponse.json({
      success: true,
      match: updatedMatch,
      kitCustody,
      nextAction: {
        type: "RECORD_KIT_CUSTODY",
        leagueId:
          updatedMatch.leagueId,
        matchId:
          updatedMatch.id,
        matchLabel:
          matchLabel(updatedMatch),
      },
    });
  } catch (error) {
    console.error(
      "Unable to end match:",
      error
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Failed to end match",
      },
      {
        status: 500,
      }
    );
  }
}
