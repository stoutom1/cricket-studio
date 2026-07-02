import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getPermissions } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";


export async function GET(request, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const matchId = Number(id);
    if (!matchId || Number.isNaN(matchId)) {
    return NextResponse.json(
      { error: "Invalid match id" },
      { status: 400 }
    );
  }
  if (!id) {
    return NextResponse.json({ error: "Invalid match id" }, { status: 400 });
  }

  const match = await prisma.match.findUnique({
    where: { id: matchId },
 include: {
  teamA: {
    include: {
      league: true,
      players: {
        orderBy: { name: "asc" }
      }
    }
  },

  teamB: {
    include: {
      league: true,
      players: {
        orderBy: { name: "asc" }
      }
    }
  },

  battingFirstTeam: true,

  balls: {
    orderBy: [
      { inningsNo: "asc" },
      { sequence: "asc" },
      { id: "asc" }
    ],
  },
}
  });

 
  if (!match) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }

  return NextResponse.json(match);
}

export async function PATCH(request, { params }) {
  const { id } = await params;
  const matchId = Number(id);
  const body = await request.json();

  const match = await prisma.match.findUnique({
    where: { id: matchId },
  });

  if (!match) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }

  if (match.status !== "SCHEDULED") {
    return NextResponse.json(
      { error: "Only scheduled matches can be edited" },
      { status: 400 }
    );
  }

  const updated = await prisma.match.update({
    where: { id: matchId },
    data: {
      scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null,
      oversPerInnings: Number(body.oversPerInnings),
      powerplayOversInnings: Number(body.powerplayOversInnings || 0),
      maxWicketsPerInnings: body.maxWicketsPerInnings ?? null,
      maxOversPerBowler: body.maxOversPerBowler ?? null,
      seriesId: body.seriesId ? Number(body.seriesId) : null,

      teamACaptainId: body.teamACaptainId ?? null,
      teamBCaptainId: body.teamBCaptainId ?? null,
      teamAWicketKeeperId: body.teamAWicketKeeperId ?? null,
      teamBWicketKeeperId: body.teamBWicketKeeperId ?? null,
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(request, { params }) {
  const session = await getServerSession(authOptions);
  const { id } = await params;
  const matchId = Number(id);

  if (!matchId || Number.isNaN(matchId)) {
    return Response.json({ error: "Invalid match id" }, { status: 400 });
  }

  const beforeMatch = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      teamA: true,
      teamB: true,
      league: true,
      series: true,
      balls: true,
    },
  });

  if (!beforeMatch) {
    return Response.json({ error: "Match not found" }, { status: 404 });
  }

await prisma.$transaction(async (tx) => {
  await tx.matchState.deleteMany({
    where: { matchId },
  });

  await tx.ball.deleteMany({
    where: { matchId },
  });

  await tx.match.delete({
    where: { id: matchId },
  });
});

  await logAudit({
    action: "MATCH_DELETED",
    entityType: "MATCH",
    entityId: matchId,

    leagueId: beforeMatch.leagueId || null,
    matchId,

    actor: session?.user,

    description: `Match "${beforeMatch.teamA?.name || "Team A"} vs ${
      beforeMatch.teamB?.name || "Team B"
    }" was deleted from league "${
      beforeMatch.league?.name || "Unknown League"
    }".`,

    beforeData: {
      id: beforeMatch.id,
      status: beforeMatch.status,
      leagueId: beforeMatch.leagueId,
      leagueName: beforeMatch.league?.name || null,
      seriesId: beforeMatch.seriesId || null,
      seriesName: beforeMatch.series?.name || null,
      teamAId: beforeMatch.teamAId,
      teamAName: beforeMatch.teamA?.name || null,
      teamBId: beforeMatch.teamBId,
      teamBName: beforeMatch.teamB?.name || null,
      battingFirstTeamId: beforeMatch.battingFirstTeamId || null,
      oversPerInnings: beforeMatch.oversPerInnings,
      powerplayOversInnings: beforeMatch.powerplayOversInnings,
      maxWicketsPerInnings: beforeMatch.maxWicketsPerInnings,
      maxOversPerBowler: beforeMatch.maxOversPerBowler,
      scheduledAt: beforeMatch.scheduledAt,
      startedAt: beforeMatch.startedAt,
      endedAt: beforeMatch.endedAt,
      ballsDeleted: beforeMatch.balls?.length || 0,
    },

    afterData: null,

    request,
  });

  return Response.json({
    success: true,
    message: "Match deleted",
  });
}