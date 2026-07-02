import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

export async function PATCH(request, { params }) {
  const { id } = await params;
  const teamId = Number(id);

  if (!teamId || Number.isNaN(teamId)) {
    return NextResponse.json({ error: "Invalid team id" }, { status: 400 });
  }

  try {
    const body = await request.json();
    const name = String(body.name || "").trim();

    if (!name) {
      return NextResponse.json(
        { error: "Team name is required" },
        { status: 400 }
      );
    }

    const existingTeam = await prisma.team.findUnique({
      where: { id: teamId },
    });

    if (!existingTeam) {
      return NextResponse.json(
        { error: "Team not found" },
        { status: 404 }
      );
    }

    const duplicate = await prisma.team.findFirst({
      where: {
        leagueId: existingTeam.leagueId,
        name,
        NOT: {
          id: teamId,
        },
      },
    });

    if (duplicate) {
      return NextResponse.json(
        { error: "Another team in this league already has this name." },
        { status: 409 }
      );
    }

    const team = await prisma.team.update({
      where: { id: teamId },
      data: { name },
    });
    const session = await getServerSession(authOptions);

await logAudit({
  action: "TEAM_UPDATED",
  entityType: "TEAM",
  entityId: team.id,
  leagueId: team.leagueId,
  teamId: team.id,
  actor: session?.user,
  description: `Team renamed from "${existingTeam.name}" to "${team.name}".`,
  beforeData: existingTeam,
  afterData: team,
  request,
});
    return NextResponse.json(team);
  } catch (err) {
    console.error("TEAM PATCH ERROR", err);

    return NextResponse.json(
      { error: "Failed to update team" },
      { status: 500 }
    );
  }
}

export async function DELETE(request, { params }) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const { id } = await params;
  const teamId = Number(id);

  if (Number.isNaN(teamId) || teamId <= 0) {
    return NextResponse.json(
      { error: "Invalid team id" },
      { status: 400 }
    );
  }

  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: {
      _count: {
        select: {
          matchesA: true,
          matchesB: true,
          players: true,
        },
      },
    },
  });

  if (!team) {
    return NextResponse.json(
      { error: "Team not found" },
      { status: 404 }
    );
  }

  const totalMatches =
    team._count.matchesA + team._count.matchesB;

  if (totalMatches > 0) {
    return NextResponse.json(
      {
        error:
          "Cannot delete team because it is used in one or more matches. Delete those matches first.",
      },
      { status: 400 }
    );
  }

  await prisma.team.delete({
    where: { id: teamId },
  });
await logAudit({
  action: "TEAM_DELETED",
  entityType: "TEAM",
  entityId: team.id,
  leagueId: team.leagueId,
  teamId: team.id,
  actor: session?.user,
  description: `Team "${team.name}" was deleted.`,
  afterData: team,
  request,
});
  return NextResponse.json({
    success: true,
    message: "Team deleted successfully",
  });
}