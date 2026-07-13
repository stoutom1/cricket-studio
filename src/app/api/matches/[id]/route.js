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
  const requestedTeamAId = Number(body.teamAId);
  const requestedTeamBId = Number(body.teamBId);

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
if (
  !Number.isInteger(requestedTeamAId) ||
  requestedTeamAId <= 0 ||
  !Number.isInteger(requestedTeamBId) ||
  requestedTeamBId <= 0
) {
  return NextResponse.json(
    { error: "Both teams are required." },
    { status: 400 }
  );
}

if (requestedTeamAId === requestedTeamBId) {
  return NextResponse.json(
    {
      error:
        "Team A and Team B must be different.",
    },
    { status: 400 }
  );
}

const existingMatch =
  await prisma.match.findUnique({
    where: {
      id: matchId,
    },
    select: {
      id: true,
      leagueId: true,
      status: true,
      battingFirstTeamId: true,
    },
  });

if (!existingMatch) {
  return NextResponse.json(
    { error: "Match not found." },
    { status: 404 }
  );
}

const normalizedStatus = String(
  existingMatch.status || ""
)
  .trim()
  .toUpperCase()
  .replace(/[\s-]+/g, "_");

if (normalizedStatus !== "SCHEDULED") {
  return NextResponse.json(
    {
      error:
        "Teams can only be changed for scheduled matches.",
    },
    { status: 409 }
  );
}

const selectedTeams =
  await prisma.team.findMany({
    where: {
      leagueId: existingMatch.leagueId,

      id: {
        in: [
          requestedTeamAId,
          requestedTeamBId,
        ],
      },
    },

    select: {
      id: true,
      name: true,

      players: {
        select: {
          id: true,
        },
      },
    },
  });

if (selectedTeams.length !== 2) {
  return NextResponse.json(
    {
      error:
        "Both selected teams must belong to this match’s league.",
    },
    { status: 400 }
  );
}

const selectedTeamA = selectedTeams.find(
  (team) => Number(team.id) === requestedTeamAId
);

const selectedTeamB = selectedTeams.find(
  (team) => Number(team.id) === requestedTeamBId
);

const teamACaptainId = body.teamACaptainId
  ? Number(body.teamACaptainId)
  : null;

const teamBCaptainId = body.teamBCaptainId
  ? Number(body.teamBCaptainId)
  : null;

const teamAWicketKeeperId =
  body.teamAWicketKeeperId
    ? Number(body.teamAWicketKeeperId)
    : null;

const teamBWicketKeeperId =
  body.teamBWicketKeeperId
    ? Number(body.teamBWicketKeeperId)
    : null;


    const teamAPlayerIds = new Set(
  selectedTeamA.players.map((player) =>
    Number(player.id)
  )
);

const teamBPlayerIds = new Set(
  selectedTeamB.players.map((player) =>
    Number(player.id)
  )
);

if (
  teamACaptainId &&
  !teamAPlayerIds.has(teamACaptainId)
) {
  return NextResponse.json(
    {
      error:
        "Team A captain must belong to the selected Team A.",
    },
    { status: 400 }
  );
}

if (
  teamAWicketKeeperId &&
  !teamAPlayerIds.has(teamAWicketKeeperId)
) {
  return NextResponse.json(
    {
      error:
        "Team A wicketkeeper must belong to the selected Team A.",
    },
    { status: 400 }
  );
}

if (
  teamBCaptainId &&
  !teamBPlayerIds.has(teamBCaptainId)
) {
  return NextResponse.json(
    {
      error:
        "Team B captain must belong to the selected Team B.",
    },
    { status: 400 }
  );
}

if (
  teamBWicketKeeperId &&
  !teamBPlayerIds.has(teamBWicketKeeperId)
) {
  return NextResponse.json(
    {
      error:
        "Team B wicketkeeper must belong to the selected Team B.",
    },
    { status: 400 }
  );
}

const battingFirstTeamId = [
  requestedTeamAId,
  requestedTeamBId,
].includes(Number(existingMatch.battingFirstTeamId))
  ? Number(existingMatch.battingFirstTeamId)
  : null;


  const updated = await prisma.match.update({
    where: { id: matchId },
    data: {
      scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null,
      oversPerInnings: Number(body.oversPerInnings),
      powerplayOversInnings: Number(body.powerplayOversInnings || 0),
      maxWicketsPerInnings: body.maxWicketsPerInnings ?? null,
      maxOversPerBowler: body.maxOversPerBowler ?? null,
      seriesId: body.seriesId ? Number(body.seriesId) : null,
teamAId: requestedTeamAId,
teamBId: requestedTeamBId,
battingFirstTeamId,
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