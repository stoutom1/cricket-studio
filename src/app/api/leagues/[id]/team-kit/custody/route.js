import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import {
  assertTeamKitTables,
  resolveTeamKitAccess,
  SHARED_SCOPE_KEY,
  teamScopeKey,
} from "@/lib/kit/team-custody";

export const runtime = "nodejs";

function positiveId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0
    ? id
    : null;
}

export async function POST(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    const { id } = await params;
    const leagueId = positiveId(id);

    if (!leagueId) {
      return NextResponse.json(
        { error: "Invalid league id." },
        { status: 400 }
      );
    }

    await assertTeamKitTables();

    const access = await resolveTeamKitAccess({
      session,
      leagueId,
    });

    if (!access.authorized) {
      return NextResponse.json(
        { error: access.error },
        { status: access.status }
      );
    }

    if (!access.canRecord) {
      return NextResponse.json(
        {
          error:
            "You do not have permission to record kit custody.",
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const taskId = positiveId(body.taskId);
    const teamId = access.sharedKit
      ? null
      : positiveId(body.teamId);
    const holderPlayerId = positiveId(
      body.holderPlayerId
    );
    const holderName = String(
      body.holderName || ""
    )
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, 160);
    const note = String(body.note || "")
      .trim()
      .slice(0, 500);
    const suggestionName = String(
      body.suggestionName || ""
    )
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, 160);
    const usedSuggestion =
      suggestionName &&
      suggestionName.toLowerCase() ===
        holderName.toLowerCase();

    if (!holderName) {
      return NextResponse.json(
        { error: "Select or enter who took the kit." },
        { status: 400 }
      );
    }

    if (
      !access.sharedKit &&
      (!teamId ||
        (!access.isOwner &&
          !access.isLeagueWideAdmin &&
          !access.allowedTeamIds.includes(teamId)))
    ) {
      return NextResponse.json(
        {
          error:
            "You cannot record custody for this team.",
        },
        { status: 403 }
      );
    }

    const scopeKey = access.sharedKit
      ? SHARED_SCOPE_KEY
      : teamScopeKey(teamId);

    let task = null;
    if (taskId) {
      const rows = await prisma.$queryRaw`
        SELECT *
        FROM "TeamKitCustodyTask"
        WHERE "id" = ${taskId}
          AND "leagueId" = ${leagueId}
          AND "scopeKey" = ${scopeKey}
        LIMIT 1
      `;
      task = rows[0] || null;
    }

    const matchId = task
      ? Number(task.matchId)
      : positiveId(body.matchId);

    const previousRows = await prisma.$queryRaw`
      SELECT *
      FROM "TeamKitState"
      WHERE "leagueId" = ${leagueId}
        AND "scopeKey" = ${scopeKey}
      LIMIT 1
    `;
    const previousState = previousRows[0] || null;

    const result = await prisma.$transaction(
      async (tx) => {
        const states = await tx.$queryRaw`
          INSERT INTO "TeamKitState"
            (
              "leagueId",
              "scopeKey",
              "teamId",
              "currentHolderPlayerId",
              "currentHolderName",
              "lastMatchId",
              "recordedByUserId",
              "updatedAt"
            )
          VALUES
            (
              ${leagueId},
              ${scopeKey},
              ${teamId},
              ${holderPlayerId},
              ${holderName},
              ${matchId},
              ${access.user.id},
              NOW()
            )
          ON CONFLICT ("leagueId", "scopeKey")
          DO UPDATE SET
            "teamId" = EXCLUDED."teamId",
            "currentHolderPlayerId" = EXCLUDED."currentHolderPlayerId",
            "currentHolderName" = EXCLUDED."currentHolderName",
            "lastMatchId" = EXCLUDED."lastMatchId",
            "recordedByUserId" = EXCLUDED."recordedByUserId",
            "updatedAt" = NOW()
          RETURNING *
        `;

        const events = await tx.$queryRaw`
          INSERT INTO "TeamKitCustodyEvent"
            (
              "leagueId",
              "scopeKey",
              "teamId",
              "matchId",
              "holderPlayerId",
              "holderName",
              "previousHolderName",
              "action",
              "note",
              "recordedByUserId"
            )
          VALUES
            (
              ${leagueId},
              ${scopeKey},
              ${teamId},
              ${matchId},
              ${holderPlayerId},
              ${holderName},
              ${previousState?.currentHolderName || null},
              ${
                previousState
                  ? "CORRECTED"
                  : usedSuggestion
                    ? "RECORDED_AS_SUGGESTED"
                    : "RECORDED"
              },
              ${
                [
                  note,
                  suggestionName
                    ? usedSuggestion
                      ? `Suggested carrier confirmed: ${suggestionName}.`
                      : `Suggested carrier was ${suggestionName}; actual holder was ${holderName}.`
                    : "",
                ]
                  .filter(Boolean)
                  .join(" ")
                  .slice(0, 500) || null
              },
              ${access.user.id}
            )
          RETURNING *
        `;

        if (taskId) {
          await tx.$executeRaw`
            UPDATE "TeamKitCustodyTask"
            SET
              "status" = 'RECORDED',
              "resolvedAt" = NOW(),
              "resolvedByUserId" = ${access.user.id}
            WHERE "leagueId" = ${leagueId}
              AND "scopeKey" = ${scopeKey}
              AND "status" = 'PENDING'
          `;
        }

        return {
          state: states[0],
          event: events[0],
        };
      }
    );

    await logAudit({
      action: previousState
        ? "TEAM_KIT_CUSTODY_CORRECTED"
        : "TEAM_KIT_CUSTODY_RECORDED",
      entityType: access.sharedKit
        ? "LEAGUE_KIT"
        : "TEAM_KIT",
      entityId: result.state.id,
      leagueId,
      teamId,
      matchId,
      actor: session?.user,
      description: access.sharedKit
        ? `Shared league-kit custody was recorded for "${holderName}".`
        : `Kit custody for team ${teamId} was recorded for "${holderName}".`,
      beforeData: previousState,
      afterData: result.state,
      request,
    });

    return NextResponse.json({
      success: true,
      message: "Kit custody recorded successfully.",
      ...result,
    });
  } catch (error) {
    console.error("Unable to record kit custody:", error);

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Unable to record kit custody.",
      },
      { status: 500 }
    );
  }
}
