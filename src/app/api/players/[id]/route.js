import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

export async function PATCH(request, { params }) {
  const { id } = await params;
  const playerId = Number(id);
  const body = await request.json();

  const session = await getServerSession(authOptions);

  if (!playerId || Number.isNaN(playerId)) {
    return Response.json({ error: "Invalid player id" }, { status: 400 });
  }

  const beforePlayer = await prisma.player.findUnique({
    where: { id: playerId },
    include: {
      team: {
        include: {
          league: true,
        },
      },
    },
  });

  if (!beforePlayer) {
    return Response.json({ error: "Player not found" }, { status: 404 });
  }

  const data = {};

  if (typeof body.name === "string") {
    const name = body.name.trim();

    if (!name) {
      return Response.json({ error: "Player name is required" }, { status: 400 });
    }

    data.name = name;
  }

  if (body.teamId) {
    data.teamId = Number(body.teamId);
  }

  const isNameChanged =
    typeof data.name === "string" &&
    data.name !== beforePlayer.name;

  const isTeamChanged =
    data.teamId &&
    Number(data.teamId) !== Number(beforePlayer.teamId);

  if (!isNameChanged && !isTeamChanged) {
    return Response.json(beforePlayer);
  }

  const player = await prisma.player.update({
    where: { id: playerId },
    data,
    include: {
      team: {
        include: {
          league: true,
        },
      },
    },
  });

  const action =
    isNameChanged && isTeamChanged
      ? "PLAYER_UPDATED_AND_TRANSFERRED"
      : isTeamChanged
      ? "PLAYER_TRANSFERRED"
      : "PLAYER_UPDATED";

  const description =
    action === "PLAYER_TRANSFERRED"
      ? `Player "${player.name}" was transferred from "${beforePlayer.team?.name || "Unknown Team"}" to "${player.team?.name || "Unknown Team"}".`
      : action === "PLAYER_UPDATED_AND_TRANSFERRED"
      ? `Player "${beforePlayer.name}" was renamed to "${player.name}" and transferred from "${beforePlayer.team?.name || "Unknown Team"}" to "${player.team?.name || "Unknown Team"}".`
      : `Player "${beforePlayer.name}" was renamed to "${player.name}" in team "${player.team?.name || "Unknown Team"}".`;

  await logAudit({
    action,
    entityType: "PLAYER",
    entityId: playerId,

    leagueId: player.team?.leagueId || beforePlayer.team?.leagueId || null,
    teamId: player.teamId || beforePlayer.teamId || null,
    playerId,

    actor: session?.user,
    description,

    beforeData: {
      id: beforePlayer.id,
      name: beforePlayer.name,
      teamId: beforePlayer.teamId,
      teamName: beforePlayer.team?.name || null,
      leagueId: beforePlayer.team?.leagueId || null,
      leagueName: beforePlayer.team?.league?.name || null,
    },

    afterData: {
      id: player.id,
      name: player.name,
      teamId: player.teamId,
      teamName: player.team?.name || null,
      leagueId: player.team?.leagueId || null,
      leagueName: player.team?.league?.name || null,
    },

    request,
  });

  return Response.json(player);
}

export async function DELETE(request, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const playerId = Number(id);
  if (!id) {
    return NextResponse.json({ error: "Invalid player id" }, { status: 400 });
  }

  const player = await prisma.player.findUnique({
    where: { id: playerId }
  });

  if (!player) {
    return NextResponse.json({ error: "Player not found" }, { status: 404 });
  }

  const ballUsageCount = await prisma.ball.count({
    where: {
      OR: [
        { strikerId: playerId },
        { nonStrikerId: playerId },
        { bowlerId: playerId },
        { dismissedPlayerId: playerId },
        { newBatterId: playerId }
      ]
    }
  });

  if (ballUsageCount > 0) {
    return NextResponse.json(
      { error: "Cannot delete player because the player is used in match scoring data. Delete related matches first." },
      { status: 400 }
    );
  }

  const team = await prisma.team.findUnique({
    where: { id: player.teamId }
  });
  const league = await prisma.league.findUnique({
    where: { id: team?.leagueId }
  });
  await prisma.player.delete({
    where: { id: playerId }
  });
  await logAudit({
    action: "PLAYER_DELETED",
    entityType: "PLAYER",
    entityId: playerId,
    leagueId: team?.leagueId || null,
    teamId: team?.id || null,
    playerId,
    actor: session?.user,
    description: `Player "${player.name}" was deleted from team "${team?.name || "Unknown Team"}"
    within league "${league?.name || "Unknown League"}".`,
    beforeData: player,
    afterData: null,
    request,
  });
  return NextResponse.json({
    success: true,
    message: "Player deleted successfully"
  });
}