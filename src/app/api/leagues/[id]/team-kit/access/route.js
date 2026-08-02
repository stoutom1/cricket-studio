import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import {
  assertTeamKitTables,
  resolveTeamKitAccess,
} from "@/lib/kit/team-custody";

export const runtime = "nodejs";

function positiveId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0
    ? id
    : null;
}

export async function PUT(request, { params }) {
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

    if (!access.canManageAccess) {
      return NextResponse.json(
        {
          error:
            "Only the league owner can manage team-kit visibility.",
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const userId = String(body.userId || "").trim();
    const teamIds = Array.isArray(body.teamIds)
      ? [...new Set(body.teamIds.map(positiveId).filter(Boolean))]
      : [];

    if (!userId) {
      return NextResponse.json(
        { error: "Select a league member." },
        { status: 400 }
      );
    }

    const selectedUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!selectedUser) {
      return NextResponse.json(
        { error: "The selected league member was not found." },
        { status: 404 }
      );
    }

    const validTeams = teamIds.length
      ? await prisma.team.findMany({
          where: {
            leagueId,
            id: { in: teamIds },
          },
          select: { id: true },
        })
      : [];

    if (validTeams.length !== teamIds.length) {
      return NextResponse.json(
        {
          error:
            "One or more selected teams do not belong to this league.",
        },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        DELETE FROM "TeamKitUserAccess"
        WHERE "leagueId" = ${leagueId}
          AND "userId" = ${userId}
      `;

      for (const teamId of teamIds) {
        await tx.$executeRaw`
          INSERT INTO "TeamKitUserAccess"
            (
              "leagueId",
              "userId",
              "teamId",
              "canView",
              "canRecord",
              "updatedAt"
            )
          VALUES
            (
              ${leagueId},
              ${userId},
              ${teamId},
              TRUE,
              FALSE,
              NOW()
            )
        `;
      }
    });

    return NextResponse.json({
      success: true,
      message: "Team-kit access updated.",
    });
  } catch (error) {
    console.error("Unable to update team-kit access:", error);

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Unable to update team-kit access.",
      },
      { status: 500 }
    );
  }
}
