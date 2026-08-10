import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

function optionalPlayerId(value) {
  if (value === null || value === undefined || value === "") return null;
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : NaN;
}

export async function PATCH(request, { params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const teamId = Number(id);
  if (!Number.isInteger(teamId) || teamId <= 0) {
    return NextResponse.json({ error: "Invalid team id" }, { status: 400 });
  }

  try {
    const body = await request.json();
    const name = String(body.name || "").trim();
    if (!name) {
      return NextResponse.json({ error: "Team name is required" }, { status: 400 });
    }

    const existingTeam = await prisma.team.findUnique({
      where: { id: teamId },
      include: { players: { select: { id: true, name: true } } },
    });
    if (!existingTeam) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    const duplicate = await prisma.team.findFirst({
      where: { leagueId: existingTeam.leagueId, name, NOT: { id: teamId } },
    });
    if (duplicate) {
      return NextResponse.json(
        { error: "Another team in this league already has this name." },
        { status: 409 }
      );
    }

    const defaultCaptainId = optionalPlayerId(body.defaultCaptainId);
    const defaultViceCaptainId = optionalPlayerId(body.defaultViceCaptainId);
    const defaultWicketKeeperId = optionalPlayerId(body.defaultWicketKeeperId);

    if ([defaultCaptainId, defaultViceCaptainId, defaultWicketKeeperId].some(Number.isNaN)) {
      return NextResponse.json({ error: "One or more permanent role selections are invalid." }, { status: 400 });
    }

    const playerIds = new Set(existingTeam.players.map((p) => Number(p.id)));
    for (const [label, playerId] of [
      ["Captain", defaultCaptainId],
      ["Vice-captain", defaultViceCaptainId],
      ["Wicketkeeper", defaultWicketKeeperId],
    ]) {
      if (playerId && !playerIds.has(playerId)) {
        return NextResponse.json(
          { error: `${label} must be a player on ${existingTeam.name}.` },
          { status: 400 }
        );
      }
    }

    if (defaultCaptainId && defaultViceCaptainId && defaultCaptainId === defaultViceCaptainId) {
      return NextResponse.json(
        { error: "Captain and vice-captain must be different players." },
        { status: 400 }
      );
    }

    const team = await prisma.team.update({
      where: { id: teamId },
      data: { name, defaultCaptainId, defaultViceCaptainId, defaultWicketKeeperId },
      include: { players: true },
    });

    await logAudit({
      action: "TEAM_UPDATED",
      entityType: "TEAM",
      entityId: team.id,
      leagueId: team.leagueId,
      teamId: team.id,
      actor: session?.user,
      description: `Team "${team.name}" and permanent roles were updated.`,
      beforeData: existingTeam,
      afterData: team,
      request,
    });

    return NextResponse.json(team);
  } catch (err) {
    console.error("TEAM PATCH ERROR", err);
    return NextResponse.json({ error: "Failed to update team" }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const teamId = Number(id);
  if (!Number.isInteger(teamId) || teamId <= 0) {
    return NextResponse.json({ error: "Invalid team id" }, { status: 400 });
  }

  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: { _count: { select: { matchesA: true, matchesB: true, players: true } } },
  });
  if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  if (team._count.matchesA + team._count.matchesB > 0) {
    return NextResponse.json(
      { error: "Cannot delete team because it is used in one or more matches. Delete those matches first." },
      { status: 400 }
    );
  }

  await prisma.team.delete({ where: { id: teamId } });
  await logAudit({
    action: "TEAM_DELETED", entityType: "TEAM", entityId: team.id,
    leagueId: team.leagueId, teamId: team.id, actor: session?.user,
    description: `Team "${team.name}" was deleted.`, afterData: team, request,
  });

  return NextResponse.json({ success: true, message: "Team deleted successfully" });
}
